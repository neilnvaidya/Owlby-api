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
  FLASH_PREVIEW: 'gemini-3-flash-preview',
  FLASH: 'gemini-3-flash',
  FLASH_OLD: 'gemini-2.5-flash',
  PRO: 'gemini-2.5-pro',
} as const;

/**
 * Route-specific model configuration
 * Defines primary and fallback models for each endpoint
 * Fallback chain: preview -> flash -> 2.5-pro
 */
export const ROUTE_MODEL_CONFIG: Record<string, {
  primary: string;
  fallback1: string;
  fallback2: string;
}> = {
  chat: {
    primary: MODELS.FLASH_PREVIEW,
    fallback1: MODELS.FLASH,
    fallback2: MODELS.PRO,
  },
  lesson: {
    primary: MODELS.FLASH_PREVIEW,
    fallback1: MODELS.FLASH,
    fallback2: MODELS.PRO,
  },
  story: {
    primary: MODELS.FLASH_PREVIEW,
    fallback1: MODELS.FLASH,
    fallback2: MODELS.PRO,
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
  thinkingBudget: number = 1500,
  temperature: number = 0.9
) {
  return {
    safetySettings: SAFETY_SETTINGS,
    responseMimeType: 'application/json',
    responseSchema,
    systemInstruction: [{ text: systemInstruction }],
    maxOutputTokens,
    temperature,
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
  maxOutputTokens: number = 4096,
  temperature: number = 0.9
) {
  return {
    safetySettings: SAFETY_SETTINGS,
    responseMimeType: 'application/json',
    responseSchema,
    systemInstruction: [{ text: systemInstruction }],
    maxOutputTokens,
    temperature,
    // Note: Flash does not support thinkingConfig
  };
}

/**
 * Route-specific temperature settings
 * Chat uses lower temperature (0.75) for more consistent factual responses
 * Lesson and Story use default (0.9) for more creative/engaging content
 */
export const ROUTE_TEMPERATURES: Record<string, number> = {
  chat: 0.75,
  lesson: 0.9,
  story: 0.9,
};

/**
 * Build AI configuration for Gemini 3 Flash Preview
 * Uses thinking config with thinkingLevel (new API)
 * Temperature always 1.0 for Gemini 3 models
 */
export function buildFlashPreviewConfig(
  responseSchema: any,
  systemInstruction: string,
  maxOutputTokens: number = 4096,
  temperature: number = 1.0
) {
  return {
    safetySettings: SAFETY_SETTINGS,
    responseMimeType: 'application/json',
    responseSchema,
    systemInstruction: [{ text: systemInstruction }],
    maxOutputTokens,
    temperature: 1.0, // Always 1.0 for Gemini 3 models
    thinkingConfig: {
      thinkingLevel: 'MEDIUM',
    },
    mediaResolution: 'MEDIA_RESOLUTION_LOW',
  };
}

/**
 * Build AI configuration for Gemini 3 Flash
 * No thinking config (Flash does not support thinking)
 * Temperature always 1.0 for Gemini 3 models
 */
export function buildFlash3Config(
  responseSchema: any,
  systemInstruction: string,
  maxOutputTokens: number = 4096,
  temperature: number = 1.0
) {
  return {
    safetySettings: SAFETY_SETTINGS,
    responseMimeType: 'application/json',
    responseSchema,
    systemInstruction: [{ text: systemInstruction }],
    maxOutputTokens,
    temperature: 1.0, // Always 1.0 for Gemini 3 models
    mediaResolution: 'MEDIA_RESOLUTION_LOW',
    // Note: Flash does not support thinkingConfig
  };
}

/**
 * Check if a model is a Gemini 3 model (preview, flash, or pro)
 */
function isGemini3Model(modelName: string): boolean {
  return modelName.includes('gemini-3');
}

/**
 * Build AI configuration based on model name
 * Automatically selects the appropriate config builder
 * Gemini 3 models always use temperature 1.0 regardless of route settings
 */
export function buildAIConfig(
  modelName: string,
  responseSchema: any,
  systemInstruction: string,
  maxOutputTokens: number = 4096,
  temperature?: number
) {
  // Gemini 3 models always use temperature 1.0
  const finalTemperature = isGemini3Model(modelName) ? 1.0 : (temperature ?? 0.9);
  
  if (modelName === MODELS.FLASH_PREVIEW) {
    return buildFlashPreviewConfig(responseSchema, systemInstruction, maxOutputTokens, finalTemperature);
  } else if (modelName === MODELS.FLASH) {
    return buildFlash3Config(responseSchema, systemInstruction, maxOutputTokens, finalTemperature);
  } else if (modelName === MODELS.PRO) {
    return buildProConfig(responseSchema, systemInstruction, maxOutputTokens, 1500, finalTemperature);
  } else if (modelName === MODELS.FLASH_OLD) {
    return buildFlashConfig(responseSchema, systemInstruction, maxOutputTokens, finalTemperature);
  } else {
    // Default to Flash config for unknown models
    console.warn(`Unknown model ${modelName}, defaulting to Flash config`);
    // If unknown model looks like Gemini 3, use 1.0, otherwise use passed/default temp
    const tempForUnknown = isGemini3Model(modelName) ? 1.0 : finalTemperature;
    return buildFlash3Config(responseSchema, systemInstruction, maxOutputTokens, tempForUnknown);
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
