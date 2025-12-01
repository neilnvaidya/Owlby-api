import { CORS_HEADERS, ai, MODEL_NAME, FALLBACK_MODEL, buildAIConfig, logTokenUsage } from './ai-config';
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
 * Standard AI request processing with automatic fallback on 503 errors
 * @param config - AI configuration object
 * @param contents - Message contents array
 * @param endpoint - Endpoint name for logging
 * @param inputText - Input text for logging
 * @param modelName - Optional model name override (uses MODEL_NAME if not provided)
 * @param isRetry - Internal flag to prevent infinite retry loops
 */
export async function processAIRequest(
  config: any,
  contents: any[],
  endpoint: string,
  inputText: string,
  modelName?: string,
  isRetry: boolean = false
): Promise<{ responseText: string; usageMetadata: any }> {
  try {
    const activeModel = modelName || MODEL_NAME;
    console.info(`🦉 [${endpoint}] → Gemini: model=${activeModel} input len=${inputText.length}`);
    
    const response = await ai.models.generateContent({
      model: activeModel,
      config,
      contents,
    });

    const responseText = response.text || (
      Array.isArray((response as any).candidates) && (response as any).candidates.length > 0
        ? (response as any).candidates[0].content?.parts?.map((p: any) => p.text).join('') || ''
        : ''
    );

    if (!responseText) {
      console.warn(`[${endpoint}] Gemini returned empty text – full response follows`);
      console.debug(JSON.stringify(response, null, 2).slice(0, 500) + '…');
      throw new Error('Empty response from AI service');
    }

    console.info(`🦉 [${endpoint}] ← Gemini: response len=${responseText.length}`);
    console.debug(`🦉 [${endpoint}] Response preview:`, responseText.slice(0, 120) + (responseText.length > 120 ? '…' : ''));

    // Log token usage for cost analysis
    logTokenUsage(endpoint, inputText, responseText, response.usageMetadata);

    return {
      responseText,
      usageMetadata: response.usageMetadata
    };

  } catch (error: any) {
    console.error(`❌ [${endpoint}] AI Error:`, error);
    
    // Handle specific error types
    if (error.message && error.message.includes('User location is not supported')) {
      throw new Error('SERVICE_UNAVAILABLE_REGION');
    }
    
    // Check for 503 Service Unavailable (model overloaded) and retry with fallback
    // Handle various error formats from Google GenAI SDK
    const errorStatus = error.status || error.code || error.error?.status || error.error?.code;
    const errorMessage = error.message || error.error?.message || '';
    const is503Error = errorStatus === 503 || 
                      (errorMessage && (
                        errorMessage.includes('503') || 
                        errorMessage.includes('overloaded') ||
                        errorMessage.includes('UNAVAILABLE') ||
                        errorMessage.includes('Service Unavailable')
                      ));
    
    if (is503Error && !isRetry) {
      // Determine fallback model
      let fallbackModel: string | undefined;
      
      if (modelName) {
        // If a specific model was requested, try the default MODEL_NAME as fallback
        fallbackModel = MODEL_NAME;
        console.info(`🔄 [${endpoint}] Model ${modelName} overloaded, retrying with fallback: ${fallbackModel}`);
      } else {
        // If using default MODEL_NAME, try FALLBACK_MODEL
        fallbackModel = FALLBACK_MODEL;
        console.info(`🔄 [${endpoint}] Model ${MODEL_NAME} overloaded, retrying with fallback: ${fallbackModel}`);
      }
      
      // Only retry if fallback is different from current model
      if (fallbackModel && fallbackModel !== (modelName || MODEL_NAME)) {
        try {
          return await processAIRequest(config, contents, endpoint, inputText, fallbackModel, true);
        } catch (fallbackError: any) {
          console.error(`❌ [${endpoint}] Fallback model also failed:`, fallbackError);
          // Continue to throw original error
        }
      }
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
  console.error(`❌ [${endpoint}] Error:`, error);

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
