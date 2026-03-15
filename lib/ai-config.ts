import { config } from 'dotenv';
import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
} from '@google/genai';

import { MODELS, ROUTE_MODEL_CONFIG, ROUTE_TEMPERATURES } from './config.js';

config();

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

export const ai = new GoogleGenAI({
  apiKey: API_KEY,
});

/** Re-export from config for callers that import from ai-config */
export { MODELS, ROUTE_MODEL_CONFIG, ROUTE_TEMPERATURES };

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
  thinkingBudget: number = 800,
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
      thinkingLevel: 'LOW',
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
