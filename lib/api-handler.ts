import { CORS_HEADERS, ai, ROUTE_MODEL_CONFIG, buildAIConfig, logTokenUsage, MODELS } from './ai-config';
import { ACHIEVEMENT_TAG_ENUM } from './badgeCategories';

/**
 * Standard API Handler Utilities for Owlby
 * Provides consistent error handling, CORS, and response patterns
 */

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
  const response = await ai.models.generateContent({
    model: modelName,
    config,
    contents,
  });

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
 * Attempts primary model twice, then falls back to secondary model on specific errors
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

  const { primary, fallback } = routeConfig;
  let lastError: any = null;
  let fallbackUsed = false;

  // Attempt primary model (with one retry)
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const config = buildAIConfig(primary, responseSchema, systemInstruction, maxOutputTokens);
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
      if (attempt === 2) {
        break;
      }
    }
  }

  // Fallback to secondary model
  try {
    const config = buildAIConfig(fallback, responseSchema, systemInstruction, maxOutputTokens);
    const result = await attemptAIRequest(fallback, config, contents, endpoint, inputText);
    
    console.warn(`⚠️ [${endpoint}] Fallback to ${fallback} succeeded`);
    return {
      ...result,
      modelUsed: fallback,
      fallbackUsed: true,
    };
  } catch (error: any) {
    console.error(`❌ [${endpoint}] Both models failed. Last error:`, error.message);
    
    // Handle specific error types for final error reporting
    if (error.message && error.message.includes('User location is not supported')) {
      throw new Error('SERVICE_UNAVAILABLE_REGION');
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
 */
export function createErrorResponse(
  error: any, 
  endpoint: string, 
  context: Record<string, any> = {}
): { status: number; body: any } {
  console.error(`❌ [${endpoint}]`, error.message || error);

  const errorMessage = error.message || 'UnknownError';

  // Handle specific error types
  if (errorMessage === 'SERVICE_UNAVAILABLE_REGION') {
    return {
      status: 503,
      body: {
        error: `${endpoint} not available in your region`,
        fallback: true,
        ...context
      }
    };
  }

  if (errorMessage.startsWith('AI_PROCESSING_FAILED')) {
    return {
      status: 500,
      body: {
        error: `Failed to process ${endpoint} request. Please try again.`,
        details: errorMessage.replace('AI_PROCESSING_FAILED: ', ''),
        ...context
      }
    };
  }

  // Default error response
  return {
    status: 500,
    body: {
      error: `An unexpected error occurred while processing your ${endpoint} request.`,
      ...context
    }
  };
}
