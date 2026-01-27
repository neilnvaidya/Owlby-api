import { CORS_HEADERS, ai, ROUTE_MODEL_CONFIG, buildAIConfig, logTokenUsage, MODELS, ROUTE_TEMPERATURES } from './ai-config';
import { ACHIEVEMENT_TAG_ENUM } from './badgeCategories';

/**
 * Standard API Handler Utilities for Owlby
 * Provides consistent error handling, CORS, and response patterns
 */

const DEFAULT_AI_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 12000);
const DEFAULT_AI_TOTAL_BUDGET_MS = Number(process.env.AI_TOTAL_BUDGET_MS ?? 15000);
const DEFAULT_AI_PRIMARY_ATTEMPTS = Number(process.env.AI_PRIMARY_ATTEMPTS ?? 1);
const DEFAULT_AI_RETRY_BACKOFF_MS = Number(process.env.AI_RETRY_BACKOFF_MS ?? 250);

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  return new Promise<T>((resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    promise.then(resolve).catch(reject);
  }).finally(() => clearTimeout(timeoutId));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Standard request validation and CORS handling
 */
export function handleCORS(req: any, res: any): boolean {
  // Set CORS headers
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle preflight (OPTIONS) request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return false; // Don't continue processing
  }

  // Validate method
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return false;
  }

  return true; // Continue processing
}

/**
 * Check if an error should trigger fallback to secondary model
 * Returns true for errors that won't be solved by retrying
 */
function shouldFallback(error: any): boolean {
  const errorMessage = error.message?.toLowerCase() || '';
  const errorCode = error.code?.toLowerCase() || '';
  
  // Rate limit errors
  if (errorMessage.includes('rate limit') || errorCode.includes('rate_limit') || errorCode === '429') {
    return true;
  }
  
  // Service unavailable errors
  if (errorMessage.includes('service unavailable') || errorMessage.includes('not available') || 
      errorMessage.includes('user location is not supported') || errorCode === '503') {
    return true;
  }
  
  // Model overload/overloaded errors
  if (errorMessage.includes('overload') || errorMessage.includes('model overload') || 
      errorMessage.includes('resource exhausted') || errorCode === '529') {
    return true;
  }

  if (errorMessage.includes('ai_request_timeout')) {
    return true;
  }
  
  return false;
}

/**
 * Attempt a single AI request with a specific model
 */
async function attemptAIRequest(
  modelName: string,
  config: any,
  contents: any[],
  endpoint: string,
  inputText: string
): Promise<{ responseText: string; usageMetadata: any }> {
  const response = await withTimeout(
    ai.models.generateContent({
      model: modelName,
      config,
      contents,
    }),
    DEFAULT_AI_TIMEOUT_MS,
    'AI_REQUEST_TIMEOUT'
  );

  const responseText = response.text || (
    Array.isArray((response as any).candidates) && (response as any).candidates.length > 0
      ? (response as any).candidates[0].content?.parts?.map((p: any) => p.text).join('') || ''
      : ''
  );

  if (!responseText) {
    console.warn(`[${endpoint}] ${modelName} returned empty text`);
    throw new Error('Empty response from AI service');
  }

  // Log token usage for cost analysis (only in development)
  logTokenUsage(endpoint, inputText, responseText, response.usageMetadata);

  return {
    responseText,
    usageMetadata: response.usageMetadata
  };
}

/**
 * Standard AI request processing with retry and fallback logic
 * Attempts primary model twice, then falls back through: flash -> 2.5-pro
 */
export async function processAIRequest(
  responseSchema: any,
  systemInstruction: string,
  contents: any[],
  endpoint: string,
  inputText: string,
  maxOutputTokens: number = 4096
): Promise<{ 
  responseText: string; 
  usageMetadata: any;
  modelUsed: string;
  fallbackUsed: boolean;
}> {
  const routeConfig = ROUTE_MODEL_CONFIG[endpoint];
  if (!routeConfig) {
    throw new Error(`No model configuration found for endpoint: ${endpoint}`);
  }

  const { primary, fallback1, fallback2 } = routeConfig;
  let lastError: any = null;
  let fallbackUsed = false;
  const startTime = Date.now();

  // Get route-specific temperature (defaults to 0.9 if not specified)
  const temperature = ROUTE_TEMPERATURES[endpoint] ?? 0.9;

  // Attempt primary model (configurable retry count)
  const primaryAttempts = Math.max(1, DEFAULT_AI_PRIMARY_ATTEMPTS);
  for (let attempt = 1; attempt <= primaryAttempts; attempt++) {
    try {
      if (Date.now() - startTime > DEFAULT_AI_TOTAL_BUDGET_MS) {
        throw new Error('AI_TOTAL_TIMEOUT');
      }
      const config = buildAIConfig(primary, responseSchema, systemInstruction, maxOutputTokens, temperature);
      const result = await attemptAIRequest(primary, config, contents, endpoint, inputText);
      
      return {
        ...result,
        modelUsed: primary,
        fallbackUsed: false,
      };
    } catch (error: any) {
      lastError = error;
      
      // If this is a fallback-triggering error, don't retry primary
      if (shouldFallback(error)) {
        break;
      }
      
      // If this is the last attempt on primary, we'll try fallback
      if (attempt === primaryAttempts) {
        break;
      }

      const backoffMs = DEFAULT_AI_RETRY_BACKOFF_MS * attempt;
      await sleep(backoffMs);
    }
  }

  if (fallback1 && fallback1 !== primary) {
    // Fallback to first fallback model (gemini-3-flash)
    try {
      if (Date.now() - startTime > DEFAULT_AI_TOTAL_BUDGET_MS) {
        throw new Error('AI_TOTAL_TIMEOUT');
      }
      const config = buildAIConfig(fallback1, responseSchema, systemInstruction, maxOutputTokens, temperature);
      const result = await attemptAIRequest(fallback1, config, contents, endpoint, inputText);
      
      console.warn(`⚠️ [${endpoint}] Fallback to ${fallback1} succeeded`);
      return {
        ...result,
        modelUsed: fallback1,
        fallbackUsed: true,
      };
    } catch (error: any) {
      lastError = error;
      console.warn(`⚠️ [${endpoint}] Fallback to ${fallback1} failed, trying ${fallback2}`);
    }
  }

  // Fallback to second fallback model (gemini-2.5-pro)
  try {
    if (fallback2 === primary || fallback2 === fallback1) {
      throw lastError || new Error('AI_PROCESSING_FAILED: duplicate fallback model');
    }
    if (Date.now() - startTime > DEFAULT_AI_TOTAL_BUDGET_MS) {
      throw new Error('AI_TOTAL_TIMEOUT');
    }
    const config = buildAIConfig(fallback2, responseSchema, systemInstruction, maxOutputTokens, temperature);
    const result = await attemptAIRequest(fallback2, config, contents, endpoint, inputText);
    
    console.warn(`⚠️ [${endpoint}] Fallback to ${fallback2} succeeded`);
    return {
      ...result,
      modelUsed: fallback2,
      fallbackUsed: true,
    };
  } catch (error: any) {
    console.error(`❌ [${endpoint}] All models failed. Last error:`, error.message);
    
    // Handle specific error types for final error reporting
    if (error.message && error.message.includes('User location is not supported')) {
      throw new Error('SERVICE_UNAVAILABLE_REGION');
    }
    
    if (error.message === 'AI_TOTAL_TIMEOUT') {
      throw new Error('AI_PROCESSING_TIMEOUT');
    }

    throw new Error(`AI_PROCESSING_FAILED: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Normalize achievement tags according to Owlby standards
 * Ensures exactly 1 required topic tag and up to 5 optional tags
 */
export function normalizeAchievementTags(data: any): void {
  try {
    // Handle required category tags
    const rawRequired: any[] = Array.isArray(data.requiredCategoryTags) 
      ? data.requiredCategoryTags 
      : Array.isArray(data.tags) 
        ? data.tags 
        : [];
    
    const filteredRequired = rawRequired.filter((t) => ACHIEVEMENT_TAG_ENUM.includes(t));
    data.requiredCategoryTags = filteredRequired.slice(0, 1); // Exactly 1 tag

    // Handle optional tags
    const rawOptional: any[] = Array.isArray(data.optionalTags) ? data.optionalTags : [];
    let normalizedOptional = rawOptional.slice(0, 5);

    // Fallback: generate optional tags if none provided
    if (normalizedOptional.length === 0) {
      // Try to extract from learn_more tags
      const lmTags = data?.interactive_elements?.learn_more?.tags;
      if (Array.isArray(lmTags) && lmTags.length > 0) {
        normalizedOptional = lmTags.slice(0, 5);
      } else {
        // Extract from main response text as last resort
        const text = data?.response_text?.main || data?.title || '';
        normalizedOptional = text
          .split(/[^a-zA-Z]+/)
          .filter(Boolean)
          .slice(0, 3);
      }
    }
    
    data.optionalTags = normalizedOptional;

  } catch (error) {
    console.warn('Failed to normalize achievement tags:', error);
    // Set safe defaults
    data.requiredCategoryTags = [];
    data.optionalTags = [];
  }
}

/**
 * Standard error response formatter
 * Always returns 200 status to prevent system error popups
 * App handles errors gracefully using success flag and user-friendly messages
 */
export function createErrorResponse(
  error: any, 
  endpoint: string, 
  context: Record<string, any> = {}
): { status: number; body: any } {
  console.error(`❌ [${endpoint}]`, error.message || error);

  const errorMessage = error.message || 'UnknownError';

  // Always return 200 status to prevent system error popups
  // App will check success flag and handle errors gracefully

  // Handle specific error types with user-friendly messages
  if (errorMessage === 'SERVICE_UNAVAILABLE_REGION') {
    return {
      status: 200,
      body: {
        success: false,
        error: "I'm not available in your region right now. Please try again later.",
        userMessage: "I'm not available in your region right now. Please try again later.",
        ...context
      }
    };
  }

  if (errorMessage.startsWith('AI_PROCESSING_FAILED')) {
    return {
      status: 200,
      body: {
        success: false,
        error: "I'm having trouble processing that right now. Please try again.",
        userMessage: "I'm having trouble processing that right now. Please try again.",
        ...context
      }
    };
  }

  // Default error response with user-friendly message
  return {
    status: 200,
    body: {
      success: false,
      error: "Something went wrong. Please try again.",
      userMessage: "Something went wrong. Please try again.",
      ...context
    }
  };
}
