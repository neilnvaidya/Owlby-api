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

// Centralized model selection for all AI calls.
// Priority:
// 1) GEMINI_MODEL_NAME (primary)
// 2) GEMINI_MODEL_NAME_FALLBACK (secondary)
// 3) hardcoded default 'gemini-2.5-flash'
const PRIMARY_MODEL = process.env.GEMINI_MODEL_NAME;
const SECONDARY_MODEL = process.env.GEMINI_MODEL_NAME_FALLBACK;
const DEFAULT_MODEL = 'gemini-2.5-flash';

export const MODEL_NAME = PRIMARY_MODEL || SECONDARY_MODEL || DEFAULT_MODEL;

// Chat-specific model override for speed (optional)
// If set, chat endpoint will use this model instead of MODEL_NAME for faster responses
// Set via GEMINI_CHAT_MODEL_NAME environment variable (e.g., gemini-2.5-flash)
export const CHAT_MODEL_NAME = process.env.GEMINI_CHAT_MODEL_NAME || null;

/**
 * Get the appropriate model name for chat endpoint
 * Automatically uses CHAT_MODEL_NAME if configured, otherwise falls back to MODEL_NAME
 */
export function getChatModelName(): string {
  return CHAT_MODEL_NAME || MODEL_NAME;
}

/**
 * Check if the model is a Gemini 3 Pro model
 */
function isGemini3Pro(modelName: string): boolean {
  return modelName.includes('gemini-3-pro') || modelName.includes('gemini-3.0-pro');
}

/**
 * Check if the model is a Gemini 2.5 Pro model
 */
function isGemini25Pro(modelName: string): boolean {
  return modelName.includes('gemini-2.5-pro') || modelName.includes('gemini-2.0-pro');
}

/**
 * Check if the model is any Pro model (supports thinking)
 */
function isProModel(modelName: string): boolean {
  return isGemini3Pro(modelName) || isGemini25Pro(modelName);
}

/**
 * Get thinking configuration for pro models
 * - Gemini 3 Pro: uses thinkingLevel ('LOW', 'MEDIUM', 'HIGH')
 *   - Configurable via GEMINI_THINKING_LEVEL env var (default: 'LOW')
 * - Gemini 2.5 Pro: uses thinkingBudget (number of tokens)
 *   - Configurable via GEMINI_THINKING_BUDGET env var (default: 1000)
 */
function getThinkingConfig(modelName: string): any {
  if (isGemini3Pro(modelName)) {
    // Gemini 3 Pro uses thinkingLevel
    // Valid values: 'LOW', 'MEDIUM', 'HIGH'
    const thinkingLevel = (process.env.GEMINI_THINKING_LEVEL || 'LOW').toUpperCase();
    const validLevels = ['LOW', 'MEDIUM', 'HIGH'];
    const level = validLevels.includes(thinkingLevel) ? thinkingLevel : 'LOW';
    
    return {
      thinkingConfig: {
        thinkingLevel: level,
      },
    };
  } else if (isGemini25Pro(modelName)) {
    // Gemini 2.5 Pro uses thinkingBudget (tokens)
    // Default budget: 1000 tokens (adjustable via GEMINI_THINKING_BUDGET env var)
    const thinkingBudget = parseInt(process.env.GEMINI_THINKING_BUDGET || '1000', 10);
    return {
      thinkingConfig: {
        thinkingBudget,
      },
    };
  }
  return {}; // No thinking config for non-pro models
}

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
 * Standard configuration builder for AI requests
 * Automatically adds thinking configuration for pro models
 * 
 * @param responseSchema - JSON schema for structured output
 * @param systemInstruction - System instruction text
 * @param maxOutputTokens - Maximum output tokens (default: 4096)
 * @param modelName - Optional model name override (uses MODEL_NAME if not provided)
 * @param options - Optional configuration overrides
 *   - disableThinking: Skip thinking config even for pro models (for speed-critical endpoints)
 */
export function buildAIConfig(
  responseSchema: any,
  systemInstruction: string,
  maxOutputTokens: number = 4096,
  modelName?: string,
  options?: {
    disableThinking?: boolean;
  }
) {
  const activeModel = modelName || MODEL_NAME;
  
  const baseConfig: any = {
    safetySettings: SAFETY_SETTINGS,
    responseMimeType: 'application/json',
    responseSchema,
    systemInstruction: [{ text: systemInstruction }],
    // Output control parameters (must be at top level of config)
    maxOutputTokens,
    // For Gemini 3 Pro, Google recommends using the model's default temperature.
    // If you need to tune creativity for specific endpoints, add a temperature here per-endpoint.
  };

  // Add thinking configuration for pro models (unless disabled for speed)
  if (isProModel(activeModel) && !options?.disableThinking) {
    const thinkingConfig = getThinkingConfig(activeModel);
    Object.assign(baseConfig, thinkingConfig);
    
    if (process.env.NODE_ENV === 'development') {
      console.info(`🧠 [AI Config] Added thinking config for ${activeModel}:`, thinkingConfig);
    }
  }

  return baseConfig;
}

/**
 * Chat-specific configuration builder with automatic optimizations
 * - Uses chat-specific model if configured (GEMINI_CHAT_MODEL_NAME), otherwise MODEL_NAME
 * - Automatically disables thinking for speed
 * - Uses token limit optimized for chat responses (increased to prevent truncation)
 */
export function buildChatConfig(
  responseSchema: any,
  systemInstruction: string
) {
  const chatModel = getChatModelName();
  
  return buildAIConfig(
    responseSchema,
    systemInstruction,
    2048, // Increased from 1024 to prevent JSON truncation (chat responses 300-800 chars ≈ 200-500 tokens, but JSON overhead needs more)
    chatModel,
    {
      disableThinking: true, // Always disable thinking for chat speed
    }
  );
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
