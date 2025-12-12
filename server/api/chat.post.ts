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

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
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
          response_format: { type: "json_object" }, // Gemini might support this or we rely on prompt
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenRouter Error:", err);
      throw createError({ statusCode: 502, statusMessage: "AI Service Error" });
    }

    const data = await response.json();
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
    console.error("API Error:", e);
    throw createError({ statusCode: 500, statusMessage: e.message });
  }
});
