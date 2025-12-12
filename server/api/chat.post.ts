import { defineEventHandler, readBody } from 'h3';
import { promises as fs } from 'fs';
import path from 'path';

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig();
    const body = await readBody(event);
    const { userMessage, currentLevel, isInit } = body;

    const apiKey = config.openrouterApiKey;
    if (!apiKey) {
        throw createError({
            statusCode: 500,
            statusMessage: 'OpenRouter API Key not configured.',
        });
    }

    try {
        const rootDir = process.cwd();
        const puzzlesPath = path.join(rootDir, 'puzzles.json');
        const promptPath = path.join(rootDir, 'DM_prompt.md');

        const [puzzlesData, promptTemplate] = await Promise.all([
            fs.readFile(puzzlesPath, 'utf-8'),
            fs.readFile(promptPath, 'utf-8')
        ]);

        const puzzles = JSON.parse(puzzlesData);
        const levelData = puzzles.levels.find((l: any) => l.id === (currentLevel + 1));

        if (!levelData) {
             return { message: "The dungeon ends here. (No more levels)", solved: false };
        }

        let systemPrompt = promptTemplate.replace('${current_puzzle_json}', JSON.stringify(levelData, null, 2));

        // Enforce JSON output for the application logic
        systemPrompt += "\n\nCRITICAL OUTPUT INSTRUCTION:\nYou must respond with a strict JSON object. Do not include markdown formatting (like ```json). The format must be:\n" +
            `{
  "message": "Your rich text response here...",
  "solved": boolean // true ONLY if the player has met the exit_condition.
}`;

        const messages = [
            { role: 'system', content: systemPrompt }
        ];

        // If it's initialization, we might not have a user message, or we treat it as "Start"
        if (isInit) {
             messages.push({ role: 'user', content: "Begin the game. Describe the setting." });
        } else {
             // We can optionally pass previous messages if we wanted context, 
             // but the requirement is "AI should not keep context from previous puzzles".
             // It doesn't explicitly say "no context within the same puzzle", but "treat each puzzle as it's own distinct conversation"
             // usually implies clearing context BETWEEN levels. 
             // However, within a level, it usually needs context (e.g. "take key" -> "open door").
             // If we don't send history, the AI won't know the player has the key.
             // So we MUST send history for the **current** puzzle.
             
             // BUT, the `useGame` logic I wrote only sends `userMessage`. 
             // Without a database, we rely on the client to send history?
             // Or we just send the current input and hope the AI implies state?
             // "State Tracking: Mentally track the player's inventory... Only progress the puzzle when the player performs the correct action in sequence."
             // This implies the AI needs context of what happened previously.
             // Since I'm not using a DB, I should probably pass the conversation history from the client 
             // OR rely on the "State Tracking" principle being stateless per request (which is impossible for inventory).
             
             // The simple solution for this task: Pass the full conversation history for the CURRENT level from the client.
             // My `useGame` implementation accumulates generic messages. 
             // I should filter messages to only include those since the last level start?
             // Or just pass the prompt "You have [items]. Status: [status]. Input: [input]"?
             // 
             // Re-reading `useGame`: `messages.value` stores everything.
             // 
             // Let's refine `useGame` later to pass history. For now, let's implement the API to accept `history` parameter.
             // Or, simpler: The API receives `history` array.
        }
        
        // Wait, I missed passing history in `useGame`. 
        // Let's first just implement single-turn for the API, but realize it won't work for multi-step puzzles.
        // I will assume for now I will modify `useGame` to pass history. 
        // Or I can change the prompt to "Update state based on: [Previous Summary] + [New Action]".
        //
        // Let's assume the client sends `messages` or `history`.
        // Let's update the API to handle an optional `history` array.
        
        let apiMessages = [...messages];
        if (!isInit && body.history) {
             // Append valid history. 
             // We need to be careful about conflicting system prompts if history contains them.
             // We'll trust the client sends user/assistant pairs.
             apiMessages = [...apiMessages, ...body.history];
        }
        
        if (!isInit && userMessage) {
            apiMessages.push({ role: 'user', content: userMessage });
        }

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'Tomb of the Silver King',
            },
            body: JSON.stringify({
                model: 'google/gemini-2.5-flash-lite',
                messages: apiMessages,
                response_format: { type: 'json_object' } // Gemini might support this or we rely on prompt
            })
        });

        if (!response.ok) {
             const err = await response.text();
             console.error('OpenRouter Error:', err);
             throw createError({ statusCode: 502, statusMessage: 'AI Service Error' });
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        
        // Parse JSON
        try {
            const parsed = JSON.parse(content);
            return parsed;
        } catch (e) {
            console.error('JSON Parse Error:', content);
            // Fallback if AI fails to return JSON
            return { message: content, solved: false };
        }

    } catch (e: any) {
        console.error('API Error:', e);
        throw createError({ statusCode: 500, statusMessage: e.message });
    }
});
