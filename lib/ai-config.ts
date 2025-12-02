import { config } from 'dotenv';
import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
} from '@google/genai';

config();

// AI Configuration Constants
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

export const ai = new GoogleGenAI({
  apiKey: API_KEY,
});

/**
 * Supported Gemini Models
 */
export const MODELS = {
  FLASH: 'gemini-2.5-flash',
  PRO: 'gemini-2.5-pro',
} as const;

/**
 * Route-specific model configuration
 * Defines primary and fallback models for each endpoint
 */
export const ROUTE_MODEL_CONFIG: Record<string, {
  primary: string;
  fallback: string;
}> = {
  chat: {
    primary: MODELS.PRO,
    fallback: MODELS.FLASH,
  },
  lesson: {
    primary: MODELS.PRO,
    fallback: MODELS.FLASH,
  },
  story: {
    primary: MODELS.PRO,
    fallback: MODELS.FLASH,
  },
};

/**
 * Standard safety settings for all Owlby AI endpoints
 * Configured for child-friendly content generation
 */
export const SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
];

/**
 * Standard CORS headers for all API endpoints
 */
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Helper to calculate approximate age from grade level
 */
export function gradeToAge(gradeLevel: number): number {
  return gradeLevel + 5; // Grade 1 = ~6 years old, Grade 3 = ~8 years old, etc.
}

/**
 * Build AI configuration for Gemini 2.5 Pro
 * Includes thinking budget configuration
 */
export function buildProConfig(
  responseSchema: any,
  systemInstruction: string,
  maxOutputTokens: number = 4096,
  thinkingBudget: number = 1500
) {
  return {
    safetySettings: SAFETY_SETTINGS,
    responseMimeType: 'application/json',
    responseSchema,
    systemInstruction: [{ text: systemInstruction }],
    maxOutputTokens,
    temperature: 0.9,
    thinkingConfig: {
      thinkingBudget,
    },
  };
}

/**
 * Build AI configuration for Gemini 2.5 Flash
 * No thinking config (Flash does not support thinking)
 */
export function buildFlashConfig(
  responseSchema: any,
  systemInstruction: string,
  maxOutputTokens: number = 4096
) {
  return {
    safetySettings: SAFETY_SETTINGS,
    responseMimeType: 'application/json',
    responseSchema,
    systemInstruction: [{ text: systemInstruction }],
    maxOutputTokens,
    temperature: 0.9,
    // Note: Flash does not support thinkingConfig
  };
}

/**
 * Build AI configuration based on model name
 * Automatically selects the appropriate config builder
 */
export function buildAIConfig(
  modelName: string,
  responseSchema: any,
  systemInstruction: string,
  maxOutputTokens: number = 4096
) {
  if (modelName === MODELS.PRO) {
    return buildProConfig(responseSchema, systemInstruction, maxOutputTokens);
  } else if (modelName === MODELS.FLASH) {
    return buildFlashConfig(responseSchema, systemInstruction, maxOutputTokens);
  } else {
    // Default to Flash config for unknown models
    console.warn(`Unknown model ${modelName}, defaulting to Flash config`);
    return buildFlashConfig(responseSchema, systemInstruction, maxOutputTokens);
  }
}

/**
 * Log detailed token usage for cost analysis and optimization
 */
export function logTokenUsage(
  endpoint: string,
  inputText: string,
  outputText: string,
  usageMetadata: any
) {
  if (process.env.NODE_ENV === 'development') {
    console.info(`🔍 [${endpoint.toUpperCase()} API] Token breakdown:`, {
      input_analysis: {
        input_length: inputText.length,
        estimated_input_tokens: Math.ceil(inputText.length / 4),
        actual_input_tokens: usageMetadata?.promptTokenCount
      },
      output_analysis: {
        output_length: outputText.length,
        estimated_output_tokens: Math.ceil(outputText.length / 4),
        actual_output_tokens: usageMetadata?.candidatesTokenCount
      },
      efficiency_metrics: {
        chars_per_input_token: usageMetadata?.promptTokenCount ? 
          (inputText.length / usageMetadata.promptTokenCount).toFixed(2) : 'N/A',
        chars_per_output_token: usageMetadata?.candidatesTokenCount ? 
          (outputText.length / usageMetadata.candidatesTokenCount).toFixed(2) : 'N/A',
        output_input_ratio: usageMetadata?.candidatesTokenCount && usageMetadata?.promptTokenCount ? 
          (usageMetadata.candidatesTokenCount / usageMetadata.promptTokenCount).toFixed(2) : 'N/A'
      },
      gemini_usage_metadata: usageMetadata
    });
  }
}
