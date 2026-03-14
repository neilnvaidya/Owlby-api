// Run: node scripts/api-test.js
// Install OpenAI SDK first: npm install openai
// Toggle which instruction parts are sent via PARTS_INCLUDED (baseline = body only).

import OpenAI from "openai";
import { buildSystemInstruction, PART_KEYS } from "./chat-instructions.js";

// Paste your DeepSeek API key here (only place you need to set it)
const API_KEY = "sk-f52e282a3a0a498aac97535fa5b5f312";
const model = "deepseek-reasoner";


// Which parts to include (build up for timing tests). Baseline: body only.
// Options: "body" | "targetAudience" | "responseRequirements" | "outputRules" | "contextAndClose"
const PARTS_INCLUDED = ["body"];

const openai = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: API_KEY || process.env.DEEPSEEK_API_KEY,
});

async function main() {
  const gradeLevel = 3;
  const recentContext = "User: What are rainbows?";

  const { systemContent, partsIncluded } = buildSystemInstruction(
    PARTS_INCLUDED,
    gradeLevel,
    recentContext
  );

  console.log("Parts included:", partsIncluded.join(" | "));
  console.log("---");

  const startMs = Date.now();
  const completion = await openai.chat.completions.create({
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: "What are rainbows?" },
    ],
    model: model,
  });
  const endMs = Date.now();
  
  console.log("Model:", model);
  console.log("Response time:", endMs - startMs, "ms");
  console.log("---");
  console.log(completion.choices[0].message.content);
}

main();
