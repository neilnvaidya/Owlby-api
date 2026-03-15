// Run: node scripts/gemini-test.js
// Uses same chat-instructions.js as api-test.js. Toggle parts via PARTS_INCLUDED for timing tests.
//
// BILLING: To use your Google Cloud paid billing (not free-tier limits), use Vertex AI:
//   export GOOGLE_GENAI_USE_VERTEXAI=true
//   export GOOGLE_CLOUD_PROJECT=your-project-id
//   export GOOGLE_CLOUD_LOCATION=us-central1
//   gcloud auth application-default login
// Then run this script (no API key needed). Without Vertex AI, the script uses the
// Gemini Developer API (API key) which has free-tier quotas regardless of Cloud billing.

import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from "@google/genai";
import { buildSystemInstruction } from "./chat-instructions.js";
import { API_KEY, MODEL, GRADE_LEVEL, CHAT_USER_PROMPT, CHAT_RECENT_CONTEXT } from "./test-config.js";

// Which parts to include (build up for timing tests). Baseline: body only.
// Options: "body" | "targetAudience" | "responseRequirements" | "outputRules" | "contextAndClose"
const PARTS_INCLUDED = ["body", "targetAudience", "responseRequirements", "outputRules", "contextAndClose"];

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

async function main() {
  if (useVertex && !process.env.GOOGLE_CLOUD_PROJECT) {
    console.error("Vertex AI requires GOOGLE_CLOUD_PROJECT (and GOOGLE_CLOUD_LOCATION).");
    process.exit(1);
  }
  if (!useVertex && !API_KEY) {
    console.error("Set GEMINI_API_KEY or use Vertex AI (GOOGLE_GENAI_USE_VERTEXAI=true, GOOGLE_CLOUD_PROJECT, gcloud auth application-default login).");
    process.exit(1);
  }

  const { systemContent, partsIncluded } = buildSystemInstruction(
    PARTS_INCLUDED,
    GRADE_LEVEL,
    CHAT_RECENT_CONTEXT
  );

  console.log("Parts included:", partsIncluded.join(" | "));
  console.log("Model:", MODEL);
  console.log("---");

  const config = {
    systemInstruction: [{ text: systemContent }],
    maxOutputTokens: 4096,
    temperature: 1.0,
    safetySettings: SAFETY_SETTINGS,
  };

  const contents = [
    {
      role: "user",
      parts: [{ text: CHAT_USER_PROMPT }],
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
    (response.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "");

  console.log("Response time:", endMs - startMs, "ms");
  console.log("---");
  console.log(text || "(no text in response)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
