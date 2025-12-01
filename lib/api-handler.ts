import { CORS_HEADERS, ai, MODEL_NAME, buildAIConfig, logTokenUsage } from './ai-config';
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
 * Standard AI request processing
 * Handles non-text parts (like thoughtSignature) and extracts all text parts correctly
 */
export async function processAIRequest(
  config: any,
  contents: any[],
  endpoint: string,
  inputText: string
): Promise<{ responseText: string; usageMetadata: any; rawResponse: any }> {
  const requestStartTime = Date.now();
  
  try {
    console.info(`🦉 [${endpoint}] → Gemini: input len=${inputText.length}`);
    console.info(`🦉 [${endpoint}] REQUEST CONFIG:`, JSON.stringify({
      model: MODEL_NAME,
      maxOutputTokens: config.maxOutputTokens,
      hasResponseSchema: !!config.responseSchema,
      hasSystemInstruction: !!config.systemInstruction,
      hasThinkingConfig: !!config.thinkingConfig,
      thinkingConfig: config.thinkingConfig
    }, null, 2));
    
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      config,
      contents,
    });

    const requestDuration = Date.now() - requestStartTime;
    
    // Log FULL RAW RESPONSE for debugging
    console.info(`🔍 [${endpoint}] FULL RAW RESPONSE:`, JSON.stringify(response, null, 2));
    
    // Extract all parts from the response
    let responseText = '';
    const allParts: any[] = [];
    const nonTextParts: any[] = [];
    
    if (response.text) {
      // Direct text property available
      responseText = response.text;
      allParts.push({ type: 'text', content: responseText });
    } else if (Array.isArray((response as any).candidates) && (response as any).candidates.length > 0) {
      const candidate = (response as any).candidates[0];
      const parts = candidate.content?.parts || [];
      
      // Process all parts - separate text and non-text
      for (const part of parts) {
        if (part.text) {
          responseText += part.text;
          allParts.push({ type: 'text', content: part.text });
        } else {
          // Non-text part (e.g., thoughtSignature, functionCall, etc.)
          nonTextParts.push(part);
          allParts.push({ 
            type: 'non-text', 
            partType: Object.keys(part)[0] || 'unknown',
            content: part 
          });
        }
      }
    }

    // Log detailed part analysis
    console.info(`🔍 [${endpoint}] RESPONSE PARTS ANALYSIS:`, {
      totalParts: allParts.length,
      textParts: allParts.filter(p => p.type === 'text').length,
      nonTextParts: nonTextParts.length,
      nonTextPartTypes: nonTextParts.map(p => p.partType),
      responseTextLength: responseText.length
    });
    
    if (nonTextParts.length > 0) {
      console.warn(`⚠️ [${endpoint}] NON-TEXT PARTS DETECTED:`, JSON.stringify(nonTextParts, null, 2));
      console.warn(`⚠️ [${endpoint}] Returning concatenation of all text parts. Please refer to the non-text parts for a full response from model.`);
    }

    if (!responseText) {
      console.error(`❌ [${endpoint}] Gemini returned empty text – full response follows`);
      console.error(`❌ [${endpoint}] FULL RESPONSE:`, JSON.stringify(response, null, 2));
      console.error(`❌ [${endpoint}] ALL PARTS:`, JSON.stringify(allParts, null, 2));
      throw new Error('Empty response from AI service');
    }

    // Extract usage metadata with detailed breakdown
    const usageMetadata = response.usageMetadata || {};
    const candidatesMetadata = (response as any).candidates?.[0]?.usageMetadata || {};
    
    // Log comprehensive response details
    console.info(`🦉 [${endpoint}] ← Gemini: response len=${responseText.length} (${requestDuration}ms)`);
    console.info(`🔍 [${endpoint}] RESPONSE DETAILS:`, {
      responseTextLength: responseText.length,
      responseTextPreview: responseText.slice(0, 200) + (responseText.length > 200 ? '...' : ''),
      requestDurationMs: requestDuration,
      hasNonTextParts: nonTextParts.length > 0
    });
    
    // Log token usage with full details
    const fullUsageMetadata = {
      ...usageMetadata,
      ...candidatesMetadata,
      // Extract thinking tokens if available
      thinkingTokens: (response as any).candidates?.[0]?.usageMetadata?.thinkingTokenCount || 
                      usageMetadata.thoughtsTokenCount || 
                      (usageMetadata.totalTokenCount && usageMetadata.promptTokenCount && usageMetadata.candidatesTokenCount
                        ? usageMetadata.totalTokenCount - usageMetadata.promptTokenCount - usageMetadata.candidatesTokenCount
                        : null)
    };
    
    logTokenUsage(endpoint, inputText, responseText, fullUsageMetadata);
    
    // Log full usage metadata
    console.info(`💰 [${endpoint}] FULL USAGE METADATA:`, JSON.stringify(fullUsageMetadata, null, 2));
    
    // Log cost breakdown
    const inputTokens = fullUsageMetadata.promptTokenCount || 0;
    const outputTokens = fullUsageMetadata.candidatesTokenCount || 0;
    const thinkingTokens = fullUsageMetadata.thinkingTokens || 0;
    const totalTokens = fullUsageMetadata.totalTokenCount || (inputTokens + outputTokens + thinkingTokens);
    
    // Pricing (update as needed)
    const inputPricePer1M = 0.30;
    const outputPricePer1M = 2.50;
    const thinkingPricePer1M = 0.30; // Assuming same as input
    
    const inputCost = (inputTokens / 1_000_000) * inputPricePer1M;
    const outputCost = (outputTokens / 1_000_000) * outputPricePer1M;
    const thinkingCost = (thinkingTokens / 1_000_000) * thinkingPricePer1M;
    const totalCost = inputCost + outputCost + thinkingCost;
    
    console.info(`💰 [${endpoint}] COST BREAKDOWN:`, {
      tokens: {
        input: inputTokens,
        output: outputTokens,
        thinking: thinkingTokens,
        total: totalTokens
      },
      cost: {
        input: `$${inputCost.toFixed(6)}`,
        output: `$${outputCost.toFixed(6)}`,
        thinking: `$${thinkingCost.toFixed(6)}`,
        total: `$${totalCost.toFixed(6)}`
      },
      rates: {
        input: `$${inputPricePer1M}/1M tokens`,
        output: `$${outputPricePer1M}/1M tokens`,
        thinking: `$${thinkingPricePer1M}/1M tokens`
      }
    });

    return {
      responseText,
      usageMetadata: fullUsageMetadata,
      rawResponse: response
    };

  } catch (error: any) {
    const requestDuration = Date.now() - requestStartTime;
    console.error(`❌ [${endpoint}] AI Error (${requestDuration}ms):`, error);
    console.error(`❌ [${endpoint}] Error details:`, {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Handle specific error types
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
