// Run: node scripts/gemini-lesson-test.js
// Same pattern as gemini-chat-test.js; uses lesson instructions and topic from chat's learn_more.
// Injection: learn_more.topic from chat response (e.g. "The science of light and color").
//
// BILLING: Use Vertex AI for paid billing (see gemini-chat-test.js).

import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from "@google/genai";
import { API_KEY, MODEL, GRADE_LEVEL, LESSON_TOPIC, LESSON_OPTIONAL_TAGS } from "./test-config.js";

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

function buildLessonInstruction(topic, gradeLevel, optionalTags = []) {
  const ageYears = gradeLevel + 5;
  const contextLine = optionalTags.length > 0
    ? `Context tags (use when relevant): ${optionalTags.slice(0, 5).join(", ")}.\n`
    : "";
  return `${BASE_OWLBY}

Create a concise lesson about "${topic}" for grade ${gradeLevel} (${ageYears} years old). Return VALID JSON only. Be brief: short sentences, minimal length.${contextLine}

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

async function main() {
  if (useVertex && !process.env.GOOGLE_CLOUD_PROJECT) {
    console.error("Vertex AI requires GOOGLE_CLOUD_PROJECT (and GOOGLE_CLOUD_LOCATION).");
    process.exit(1);
  }
  if (!useVertex && !API_KEY) {
    console.error("Set GEMINI_API_KEY or use Vertex AI.");
    process.exit(1);
  }

  const systemContent = buildLessonInstruction(LESSON_TOPIC, GRADE_LEVEL, LESSON_OPTIONAL_TAGS);

  console.log("Topic (learn_more injection):", LESSON_TOPIC);
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
      parts: [{ text: `topic = ${LESSON_TOPIC}, grade ${GRADE_LEVEL}, age ${GRADE_LEVEL + 5}` }],
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
