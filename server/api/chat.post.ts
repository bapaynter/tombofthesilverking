import { defineEventHandler, readBody } from "h3";
import { promises as fs } from "fs";
import path from "path";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const body = await readBody(event);
  const { userMessage, currentLevel, isInit } = body;

  const apiKey = config.openrouterApiKey;
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "OpenRouter API Key not configured.",
    });
  }

  try {
    const rootDir = process.cwd();
    const puzzlesPath = path.join(rootDir, "puzzles.json");
    const promptPath = path.join(rootDir, "DM_prompt.md");

    const [puzzlesData, promptTemplate] = await Promise.all([
      fs.readFile(puzzlesPath, "utf-8"),
      fs.readFile(promptPath, "utf-8"),
    ]);

    const puzzles = JSON.parse(puzzlesData);
    const levelData = puzzles.levels.find(
      (l: any) => l.id === currentLevel + 1
    );

    if (!levelData) {
      return {
        message: "The dungeon ends here. (No more levels)",
        solved: false,
      };
    }

    let systemPrompt = promptTemplate.replace(
      "${current_puzzle_json}",
      JSON.stringify(levelData, null, 2)
    );

    // Enforce JSON output for the application logic
    systemPrompt +=
      "\n\nCRITICAL OUTPUT INSTRUCTION:\nYou must respond with a strict JSON object. Do not include markdown formatting (like ```json). The format must be:\n" +
      `{
  "message": "Your rich text response here...",
  "solved": boolean // true ONLY if the player has met the exit_condition.
}`;

    const messages = [{ role: "system", content: systemPrompt }];

    // If it's initialization, we might not have a user message, or we treat it as "Start"
    if (isInit) {
      messages.push({
        role: "user",
        content: "Begin the game. Describe the setting.",
      });
    }

    let apiMessages = [...messages];
    if (!isInit && body.history) {
      apiMessages = [...apiMessages, ...body.history];
    }

    if (!isInit && userMessage) {
      apiMessages.push({ role: "user", content: userMessage });
    }

    let response;
    let data;

    try {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "Tomb of the Silver King",
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001",
          messages: apiMessages,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });
    } catch (fetchError: any) {
      console.error("AI Provider Network Error:", fetchError);

      // Handle specific error types
      if (
        fetchError.name === "AbortError" ||
        fetchError.name === "TimeoutError"
      ) {
        throw createError({
          statusCode: 504,
          statusMessage: "AI provider request timed out. Please try again.",
        });
      }

      throw createError({
        statusCode: 503,
        statusMessage:
          "Unable to reach AI provider. Please check your connection and try again.",
      });
    }

    if (!response.ok) {
      const err = await response.text().catch(() => "Unknown error");
      console.error("OpenRouter Error Response:", {
        status: response.status,
        statusText: response.statusText,
        body: err,
      });

      // Handle specific HTTP error codes
      if (response.status === 429) {
        throw createError({
          statusCode: 429,
          statusMessage:
            "AI provider rate limit exceeded. Please wait a moment and try again.",
        });
      }

      if (response.status === 401 || response.status === 403) {
        throw createError({
          statusCode: 500,
          statusMessage:
            "AI provider authentication error. Please contact support.",
        });
      }

      if (response.status >= 500) {
        throw createError({
          statusCode: 502,
          statusMessage:
            "AI provider is experiencing issues. Please try again in a moment.",
        });
      }

      throw createError({
        statusCode: 502,
        statusMessage: "AI provider error. Please try again.",
      });
    }

    try {
      data = await response.json();
    } catch (jsonError) {
      console.error("Failed to parse AI provider response:", jsonError);
      throw createError({
        statusCode: 502,
        statusMessage:
          "Received invalid response from AI provider. Please try again.",
      });
    }

    // Validate response structure
    if (
      !data ||
      !data.choices ||
      !data.choices[0] ||
      !data.choices[0].message
    ) {
      console.error("Invalid AI provider response structure:", data);
      throw createError({
        statusCode: 502,
        statusMessage:
          "Received unexpected response format from AI provider. Please try again.",
      });
    }

    const content = data.choices[0].message.content;

    // Parse JSON
    try {
      const parsed = JSON.parse(content);
      return parsed;
    } catch (e) {
      console.error("JSON Parse Error:", content);
      // Fallback if AI fails to return JSON
      return { message: content, solved: false };
    }
  } catch (e: any) {
    console.error("API Handler Error:", {
      message: e.message,
      stack: e.stack,
      statusCode: e.statusCode,
    });

    // If it's already a createError error, rethrow it
    if (e.statusCode) {
      throw e;
    }

    // Handle file system errors
    if (e.code === "ENOENT") {
      throw createError({
        statusCode: 500,
        statusMessage:
          "Game configuration files not found. Please contact support.",
      });
    }

    // Generic fallback error
    throw createError({
      statusCode: 500,
      statusMessage: "An unexpected error occurred. Please try again.",
    });
  }
});
