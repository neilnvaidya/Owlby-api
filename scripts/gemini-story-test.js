// Run: node scripts/gemini-story-test.js
// Same pattern as gemini-chat-test.js; uses story instructions and prompt from chat's story_button.
// Injection: story_button.prompt from chat response (e.g. "a prism catching sunlight").
//
// BILLING: Use Vertex AI for paid billing (see gemini-chat-test.js).

import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from "@google/genai";
import { API_KEY, MODEL, GRADE_LEVEL, STORY_PROMPT, STORY_OPTIONAL_TAGS } from "./test-config.js";

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

const TAG_ENUM = "READING_STORIES, LANGUAGE_WORDS, MATH_NUMBERS, ANIMALS_NATURE, SPACE_PLANETS, EXPERIMENTS_DISCOVERY, COUNTRIES_CULTURES, HISTORY_HEROES, CREATIVITY_ARTS";
const TAG_RULES = `
TAGS OUTPUT RULES:
- requiredCategoryTags: 1–3 UPPERCASE ENUM values from [${TAG_ENUM}]; these are TOPIC categories only. Do NOT include usage/behavior categories like CHAT_CHAMPION, DAILY_LEARNER.
- optionalTags (REQUIRED): 3–10 detailed context tags as free-form strings (e.g., specific people, places, concepts mentioned). Do NOT include PII.`;

function buildStoryInstruction(prompt, gradeLevel, optionalTags = []) {
  const ageYears = gradeLevel + 5;
  const contextLine = optionalTags.length > 0
    ? `Context tags (use when relevant): ${optionalTags.slice(0, 5).join(", ")}.\n`
    : "";
  return `${BASE_OWLBY}

Create a short story for prompt: "${prompt}", grade ${gradeLevel} (${ageYears} years old). Return VALID JSON only. Be concise: short paragraphs.${contextLine}

STRUCTURE:
- title: ≤50 chars
- content: 3–4 paragraphs, 1–2 sentences each
- characters: list main characters (short)
- setting: one short sentence
- moral: optional, one sentence

${TAG_RULES}

Return ONLY the JSON.`;
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

  const systemContent = buildStoryInstruction(STORY_PROMPT, GRADE_LEVEL, STORY_OPTIONAL_TAGS);

  console.log("Prompt (story_button injection):", STORY_PROMPT);
  console.log("Model:", MODEL);
  console.log("---");

  const config = {
    systemInstruction: [{ text: systemContent }],
    maxOutputTokens: 4096,
    temperature: 0.9,
    safetySettings: SAFETY_SETTINGS,
  };

  const contents = [
    {
      role: "user",
      parts: [{ text: `prompt = ${STORY_PROMPT}, grade ${GRADE_LEVEL}, age ${GRADE_LEVEL + 5}` }],
    },
  ];

  const startMs = Date.now();
  const response = await ai.models.generateContent({
    model: MODEL,
    config,
    contents,
  });
  const endMs = Date.now();

  const text =
    response.text ??
    (response.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("") ?? "");

  if (response.candidates?.[0]?.content?.parts?.some((p) => p.thoughtSignature)) {
    console.log("there are non-text parts thoughtSignature in the response, returning concatenation of all text parts. Please refer to the non text parts for a full response from model.");
  }
  console.log("Response time:", endMs - startMs, "ms");
  console.log("---");
  console.log(text || "(no text in response)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
