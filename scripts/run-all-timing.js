// Run: node scripts/run-all-timing.js
// Runs chat (for each cumulative instruction-part set), then lesson, then story, for one model.
// Writes one row to the data file after each instruction set (chat_parts combo).
// Change everything below in the CONFIG block.

import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from "@google/genai";
import { buildSystemInstruction, PART_KEYS } from "./chat-instructions.js";
import {
  API_KEY,
  MODEL,
  GRADE_LEVEL,
  CHAT_USER_PROMPT,
  CHAT_RECENT_CONTEXT,
  LESSON_TOPIC,
  LESSON_OPTIONAL_TAGS,
  STORY_PROMPT,
  STORY_OPTIONAL_TAGS,
} from "./test-config.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "timing-data.csv");

const useVertex = process.env.GOOGLE_GENAI_USE_VERTEXAI === "true";
const ai = useVertex
  ? new GoogleGenAI({
      vertexai: true,
      project: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
    })
  : new GoogleGenAI({ apiKey: API_KEY });

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
];

const TAG_ENUM = "READING_STORIES, LANGUAGE_WORDS, MATH_NUMBERS, ANIMALS_NATURE, SPACE_PLANETS, EXPERIMENTS_DISCOVERY, COUNTRIES_CULTURES, HISTORY_HEROES, CREATIVITY_ARTS";
const TAG_RULES = `
TAGS OUTPUT RULES:
- requiredCategoryTags: 1–3 UPPERCASE ENUM values from [${TAG_ENUM}]; these are TOPIC categories only. Do NOT include usage/behavior categories like CHAT_CHAMPION, DAILY_LEARNER.
- optionalTags (REQUIRED): 3–10 detailed context tags as free-form strings. Do NOT include PII.`;

const BASE_OWLBY = `You are Owlby – a wise, knowledgeable, and engaging owl mentor for curious students.

PERSONALITY:
- Friendly and intellectually respectful - like a knowledgeable teacher who treats students as capable learners
- Direct and factual - answer questions clearly and completely
- Educational focus with grade-appropriate content
- Positive and encouraging without being patronizing

DO NOT:
- Use baby talk or patronizing language
- Truncate responses or end with "..." or ellipsis
- Use excessive "Hoot hoot!" expressions (only very rarely for special celebratory moments)
- Talk down to users - respect their intelligence
- Give vague or incomplete answers

SAFETY & CONTENT RULES:
- All content must be age-appropriate and child-safe
- Educational and enriching focus
- No scary, violent, or inappropriate themes
- Encourage curiosity and deeper learning`;

function buildLessonInstruction(topic, gLevel, optionalTags = []) {
  const ageYears = gLevel + 5;
  const contextLine = optionalTags.length > 0 ? `Context tags (use when relevant): ${optionalTags.slice(0, 5).join(", ")}.\n` : "";
  return `${BASE_OWLBY}

Create a concise lesson about "${topic}" for grade ${gLevel} (${ageYears} years old). Return VALID JSON only. Be brief: short sentences, minimal length.${contextLine}

STRUCTURE (keep each item short):
1. title – ≤50 chars, catchy
2. introduction – one sentence
3. body – 2–3 short paragraphs, 80–150 characters each; **bold** key terms (1–2 per paragraph)
4. conclusion – one sentence
5. keyPoints – 2–3 bullets
6. keywords – 3–5 {term, definition}
7. difficulty – 0–20
8. challengeQuiz – 3–5 MCQs, 4 options each, short explanations

${TAG_RULES}

Return ONLY the JSON.`;
}

function buildStoryInstruction(prompt, gLevel, optionalTags = []) {
  const ageYears = gLevel + 5;
  const contextLine = optionalTags.length > 0 ? `Context tags (use when relevant): ${optionalTags.slice(0, 5).join(", ")}.\n` : "";
  return `${BASE_OWLBY}

Create a short story for prompt: "${prompt}", grade ${gLevel} (${ageYears} years old). Return VALID JSON only. Be concise: short paragraphs.${contextLine}

STRUCTURE:
- title: ≤50 chars
- content: 3–4 paragraphs, 1–2 sentences each
- characters: list main characters (short)
- setting: one short sentence
- moral: optional, one sentence

${TAG_RULES}

Return ONLY the JSON.`;
}

function escapeCsv(s) {
  const t = String(s);
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "model,chat_parts,chat_ms,lesson_ms,story_ms,timestamp\n", "utf8");
  }
}

function appendResult(model, chatParts, chatMs, lessonMs, storyMs) {
  ensureDataFile();
  const row = [
    escapeCsv(model),
    escapeCsv(chatParts),
    chatMs,
    lessonMs,
    storyMs,
    escapeCsv(new Date().toISOString()),
  ].join(",") + "\n";
  fs.appendFileSync(DATA_FILE, row, "utf8");
}

async function runChat(partsIncluded) {
  const { systemContent } = buildSystemInstruction(partsIncluded, GRADE_LEVEL, CHAT_RECENT_CONTEXT);
  const config = {
    systemInstruction: [{ text: systemContent }],
    maxOutputTokens: 4096,
    temperature: 1.0,
    safetySettings: SAFETY_SETTINGS,
  };
  const contents = [{ role: "user", parts: [{ text: CHAT_USER_PROMPT }] }];
  const start = Date.now();
  const response = await ai.models.generateContent({ model: MODEL, config, contents });
  const ms = Date.now() - start;
  const text = response.text ?? (response.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("") ?? "");
  return { ms, text };
}

async function runLesson() {
  const systemContent = buildLessonInstruction(LESSON_TOPIC, GRADE_LEVEL, LESSON_OPTIONAL_TAGS);
  const config = {
    systemInstruction: [{ text: systemContent }],
    maxOutputTokens: 4096,
    temperature: 0.9,
    safetySettings: SAFETY_SETTINGS,
  };
  const contents = [{ role: "user", parts: [{ text: `topic = ${LESSON_TOPIC}, grade ${GRADE_LEVEL}, age ${GRADE_LEVEL + 5}` }] }];
  const start = Date.now();
  const response = await ai.models.generateContent({ model: MODEL, config, contents });
  const ms = Date.now() - start;
  const text = response.text ?? (response.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("") ?? "");
  return { ms, text };
}

async function runStory() {
  const systemContent = buildStoryInstruction(STORY_PROMPT, GRADE_LEVEL, STORY_OPTIONAL_TAGS);
  const config = {
    systemInstruction: [{ text: systemContent }],
    maxOutputTokens: 4096,
    temperature: 0.9,
    safetySettings: SAFETY_SETTINGS,
  };
  const contents = [{ role: "user", parts: [{ text: `prompt = ${STORY_PROMPT}, grade ${GRADE_LEVEL}, age ${GRADE_LEVEL + 5}` }] }];
  const start = Date.now();
  const response = await ai.models.generateContent({ model: MODEL, config, contents });
  const ms = Date.now() - start;
  const text = response.text ?? (response.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("") ?? "");
  return { ms, text };
}

async function main() {
  if (useVertex && !process.env.GOOGLE_CLOUD_PROJECT) {
    console.error("Vertex AI requires GOOGLE_CLOUD_PROJECT (and GOOGLE_CLOUD_LOCATION).");
    process.exit(1);
  }
  if (!useVertex && !API_KEY) {
    console.error("Set GEMINI_API_KEY or use Vertex AI.");
    process.exit(1);
  }

  // Cumulative instruction-part sets: body → body+targetAudience → ... → full
  const partSets = [];
  for (let i = 1; i <= PART_KEYS.length; i++) {
    partSets.push(PART_KEYS.slice(0, i));
  }

  console.log("Model:", MODEL);
  console.log("Instruction sets (chat parts):", partSets.map((p) => p.join(" | ")).join(" → "));
  console.log("Data file:", DATA_FILE);
  console.log("---");

  for (let i = 0; i < partSets.length; i++) {
    const parts = partSets[i];
    const partsLabel = parts.join(" | ");
    console.log(`[${i + 1}/${partSets.length}] Chat parts: ${partsLabel}`);

    const chatResult = await runChat(parts);
    console.log(`  chat:   ${chatResult.ms} ms`);

    const lessonResult = await runLesson();
    console.log(`  lesson: ${lessonResult.ms} ms`);

    const storyResult = await runStory();
    console.log(`  story:  ${storyResult.ms} ms`);

    appendResult(MODEL, partsLabel, chatResult.ms, lessonResult.ms, storyResult.ms);
    console.log(`  → written to ${DATA_FILE}`);
    console.log("");
  }

  console.log("Done. All rows appended to", DATA_FILE);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
