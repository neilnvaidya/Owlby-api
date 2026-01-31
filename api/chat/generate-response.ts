import { logChatCall, flushApiLogger } from '../../lib/api-logger';

import { chatResponseSchema } from '../../lib/ai-schemas';
import { getChatInstructions, getChatInstructionsForFlash25 } from '../../lib/ai-instructions';
import { 
  handleCORS, 
  processAIRequest, 
  normalizeAchievementTags, 
  createErrorResponse 
} from '../../lib/api-handler';
import { MODELS, ROUTE_MODEL_CONFIG } from '../../lib/ai-config';
import { verifySupabaseToken } from '../../lib/auth-supabase';
import { checkRateLimit } from '../../lib/rate-limit';

// Toggle Supabase API logging - Always enabled for cost tracking
const ENABLE_API_LOGGING = true;
const ENABLE_TIMING_LOGS = process.env.ENABLE_TIMING_LOGS !== 'false';

function logTimingSummary(data: {
  totalMs: number;
  authMs: number;
  aiMs: number;
  modelUsed: string;
  fallbackUsed: boolean;
  userId: string;
  chatId: string;
  success: boolean;
}) {
  if (!ENABLE_TIMING_LOGS) return;
  console.info('[CHAT API] Timing summary', {
    totalMs: data.totalMs,
    authMs: data.authMs,
    aiMs: data.aiMs,
    modelUsed: data.modelUsed,
    fallbackUsed: data.fallbackUsed,
    userId: data.userId,
    chatId: data.chatId,
    success: data.success,
  });
}

/**
 * Process the JSON response from Owlby chat API
 * No truncation applied - AI schema and instructions constrain output sizes appropriately
 */
function processOwlbyResponse(responseText: string) {
  try {
    const jsonResponse = JSON.parse(responseText);
    
    if (jsonResponse.response_text && jsonResponse.interactive_elements) {
      return {
        success: true,
        data: jsonResponse
      };
    } else {
      throw new Error('Invalid JSON structure');
    }
  } catch (error) {
    console.warn('Failed to parse JSON response, falling back to plain text:', error);
    
    return {
      success: false,
      data: {
        response_text: {
          main: responseText,
          follow_up: "What would you like to learn about next?"
        },
        interactive_elements: {
          followup_buttons: [
            "Tell me more!",
            "Something new"
          ],
          learn_more: {
            topic: "Explore this topic further"
          },
          story_button: {
            prompt: "Tell me a fun story about this topic"
          }
        },
        content_blocks: {
          safety_filter: false
        }
      }
    };
  }
}

/**
 * Process the full response with metadata
 */
function processResponse(responseText: string, query: string, gradeLevel: number, chatId: string) {
  const processedResponse = processOwlbyResponse(responseText);
  
  return {
    ...processedResponse.data,
    chatId,
    gradeLevel,
    success: processedResponse.success
  };
}

export default async function handler(req: any, res: any) {
  // Log incoming request to Vercel logs
  const requestStartTime = Date.now();
  const timestamp = new Date().toISOString();
  const method = req.method || 'POST';
  const url = req.url || '/api/chat/generate-response';
  const userAgent = req.headers?.['user-agent'] || 'unknown';
  const ip = req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'] || 'unknown';
  
  // Log incoming request to Vercel logs - using console.log for better visibility
  console.log(`[CHAT API] ${timestamp} - ${method} ${url}`);
  console.log(`[CHAT API] IP: ${ip} | User-Agent: ${userAgent}`);
  console.log('[CHAT API] Request details:', JSON.stringify({
    method,
    url,
    userAgent,
    ip,
    timestamp,
  }, null, 2));

  // Handle CORS and validate request method
  if (!handleCORS(req, res)) return;

  const startTime = Date.now();
  let aiDurationMs = 0;
  const timing: Record<string, number> = {};
  const mark = (label: string, from: number) => {
    timing[label] = Date.now() - from;
  };

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Missing authorization token',
      userMessage: 'Please sign in again.',
    });
  }

  let decoded: any;
  try {
    const authStart = Date.now();
    decoded = await verifySupabaseToken(token);
    const authDurationMs = Date.now() - authStart;
    (req as any)._authDurationMs = authDurationMs;
    mark('authMs', authStart);
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      userMessage: 'Session expired. Please sign in again.',
    });
  }

  const userId = decoded?.id || 'unknown';
  const parseStart = Date.now();
  const { messages, chatId, gradeLevel = 3, sessionMemory } = req.body;
  mark('parseBodyMs', parseStart);

  // Validate required parameters
  if (!messages || !Array.isArray(messages) || messages.length === 0 || !chatId) {
    if (ENABLE_API_LOGGING) {
      logChatCall({
        userId,
        chatId: chatId || 'unknown',
        gradeLevel,
        message: '[multi-turn]',
        responseTimeMs: Date.now() - startTime,
        success: false,
        error: 'BadRequest',
        model: 'unknown',
      });
      void flushApiLogger();
    }
    
    return res.status(400).json({
      success: false,
      response_text: {
        main: "I'm having trouble understanding that. Could you try asking again?",
        follow_up: "What would you like to learn about?"
      },
      interactive_elements: {
        followup_buttons: ["Try again", "Ask something else"],
        learn_more: { topic: "" },
        story_button: { prompt: "" }
      },
      content_blocks: {
        safety_filter: false
      },
      chatId: chatId || 'unknown',
      gradeLevel,
      error: "Invalid request. Please try again."
    });
  }

  // Basic per-user rate limiting to reduce spamming
  const rateStart = Date.now();
  const rate = checkRateLimit(`chat:${userId}`, 10, 60 * 1000);
  mark('rateLimitMs', rateStart);
  if (!rate.allowed) {
    return res.status(429).json({
      success: false,
      response_text: {
        main: "I'm answering lots of questions right now. Let's pause for a moment.",
        follow_up: "Try again in a few seconds?",
      },
      interactive_elements: {
        followup_buttons: ["Try again soon"],
        learn_more: { topic: "" },
        story_button: { prompt: "" }
      },
      content_blocks: {
        safety_filter: false
      },
      chatId: chatId || 'unknown',
      gradeLevel,
      error: "Too many requests",
      retryAfterMs: rate.retryAfterMs,
    });
  }

  // Track model usage for logging (declared outside try/catch for scope)
  let modelUsed = 'unknown';
  let fallbackUsed = false;
  let wasSuccessful = true;
  
  // Extract last user message for logging (declared outside try/catch for scope)
  const lastUserMessage = messages && messages.length > 0
    ? messages.filter((m: any) => m.role === 'user').slice(-1)[0]?.text || ''
    : '';

  try {
    const previewMsg = messages && messages.length > 0 
      ? (messages[0].text?.slice(0, 60) + (messages[0].text?.length > 60 ? '…' : '')) 
      : '';
    
    // Build system instructions using existing utility
    // Use the last 3 messages for context (most recent conversation)
    const instructionsStart = Date.now();
    const recentContext = messages
      .slice(-3)
      .map((m: any, idx: number) => `${idx + 1}. ${m.role === 'user' ? 'User' : 'Owlby'}: "${m.text.slice(0, 100)}${m.text.length > 100 ? '…' : ''}"`)
      .join('\n');

    const primaryModel = ROUTE_MODEL_CONFIG.chat?.primary;
    const systemInstructions = primaryModel === MODELS.FLASH_OLD
      ? getChatInstructionsForFlash25(gradeLevel, recentContext)
      : getChatInstructions(gradeLevel, recentContext);
    mark('instructionsMs', instructionsStart);
    
    // Create contents for AI request
    const contents = [
      {
        role: 'user',
        parts: [{ text: lastUserMessage }],
      },
    ];

    let processedResponse: any;

    try {
      const aiStart = Date.now();
      
      // Process AI request using centralized handler with retry and fallback
      const { responseText, usageMetadata, modelUsed: usedModel, fallbackUsed: usedFallback } = await processAIRequest(
        chatResponseSchema,
        systemInstructions,
        contents,
        'chat',
        lastUserMessage,
        2048
      );
      
      modelUsed = usedModel;
      fallbackUsed = usedFallback;
      aiDurationMs = Date.now() - aiStart;
      timing.aiMs = aiDurationMs;
      const promptTokens = usageMetadata?.promptTokenCount ?? 0;
      const outputTokens = usageMetadata?.candidatesTokenCount ?? 0;
      const thinkingTokens = usageMetadata?.thinkingTokenCount ?? usageMetadata?.thoughtsTokenCount ?? 0;
      const totalTokens = usageMetadata?.totalTokenCount ?? (promptTokens + outputTokens + thinkingTokens);
      timing.promptTokens = promptTokens;
      timing.outputTokens = outputTokens;
      timing.thinkingTokens = thinkingTokens;
      timing.totalTokens = totalTokens;
      
      // Process complete response
      const processStart = Date.now();
      processedResponse = processResponse(responseText, '[multi-turn]', gradeLevel, chatId);
      mark('processResponseMs', processStart);
      
      // Normalize achievement tags
      const normalizeStart = Date.now();
      normalizeAchievementTags(processedResponse);
      mark('normalizeTagsMs', normalizeStart);
      
      // Extensive logging for debugging interactive elements
      console.log('[CHAT API] Full response structure:', JSON.stringify({
        hasResponseText: !!processedResponse.response_text,
        hasInteractiveElements: !!processedResponse.interactive_elements,
        interactiveElements: processedResponse.interactive_elements,
        learnMore: processedResponse.interactive_elements?.learn_more,
        storyButton: processedResponse.interactive_elements?.story_button,
        optionalTags: processedResponse.optionalTags,
        requiredCategoryTags: processedResponse.requiredCategoryTags,
      }, null, 2));

      // Always log chat API usage for cost tracking
      const logStart = Date.now();
      logChatCall({
        userId,
        chatId,
        gradeLevel,
        message: lastUserMessage, // Use actual user message instead of placeholder
        responseText,
        responseTimeMs: Date.now() - startTime,
        success: true,
        usageMetadata,
        model: modelUsed,
      });
      void flushApiLogger();
      mark('logEnqueueMs', logStart);

    } catch (aiError: any) {
      wasSuccessful = false;
      // Always log chat API usage for cost tracking (even on errors)
      logChatCall({
        userId,
        chatId,
        gradeLevel,
        message: lastUserMessage, // Use actual user message instead of placeholder
        responseTimeMs: Date.now() - startTime,
        success: false,
        error: aiError.message || 'UnknownError',
        model: modelUsed,
      });
      void flushApiLogger();

      // Handle specific AI errors with fallback responses
      if (aiError.message === 'SERVICE_UNAVAILABLE_REGION') {
        processedResponse = {
          response_text: {
            main: "I'm sorry, but I'm not available in your region at the moment. Is there anything else I can help you with?"
          },
          interactive_elements: {
            followup_buttons: ["Try again", "Ask something else"],
            learn_more: { topic: "" },
            story_button: { prompt: "" }
          },
          requiredCategoryTags: [],
          optionalTags: []
        };
      } else {
        processedResponse = {
          response_text: {
            main: "I'm having trouble processing your request right now. Can you try asking something else?"
          },
          interactive_elements: {
            followup_buttons: ["Try again", "Ask something else"],
            learn_more: { topic: "" },
            story_button: { prompt: "" }
          },
          requiredCategoryTags: [],
          optionalTags: []
        };
      }
    }

    // Final flush before returning (logging already done above)
    void flushApiLogger();

    logTimingSummary({
      totalMs: Date.now() - startTime,
      authMs: (req as any)._authDurationMs ?? 0,
      aiMs: aiDurationMs,
      modelUsed,
      fallbackUsed,
      userId,
      chatId,
      success: wasSuccessful,
    });

    if (ENABLE_TIMING_LOGS) {
      console.info('[CHAT API] Timing breakdown', {
        totalMs: Date.now() - startTime,
        ...timing,
        modelUsed,
        fallbackUsed,
        success: wasSuccessful,
      });
    }
    
    return res.status(200).json(processedResponse);

  } catch (error: any) {
    wasSuccessful = false;
    // Always log chat API usage for cost tracking (even on errors)
    logChatCall({
      userId,
      chatId,
      gradeLevel,
      message: lastUserMessage || '[unknown]', // Use actual user message if available
      responseTimeMs: Date.now() - startTime,
      success: false,
      error: error.message || 'UnknownApiError',
      model: modelUsed || 'unknown',
    });
    void flushApiLogger();

    logTimingSummary({
      totalMs: Date.now() - startTime,
      authMs: (req as any)._authDurationMs ?? 0,
      aiMs: aiDurationMs,
      modelUsed,
      fallbackUsed,
      userId,
      chatId: req.body?.chatId || 'unknown',
      success: wasSuccessful,
    });

    if (ENABLE_TIMING_LOGS) {
      console.info('[CHAT API] Timing breakdown', {
        totalMs: Date.now() - startTime,
        ...timing,
        modelUsed,
        fallbackUsed,
        success: wasSuccessful,
        error: error.message || 'UnknownError',
      });
    }

    // Return graceful error response matching ChatResponse structure
    const errorMessage = error.message || 'Unknown error';
    const userFriendlyMessage = errorMessage.includes('region') 
      ? "I'm not available in your region right now. Please try again later."
      : "I'm having trouble processing that right now. Can you try asking something else?";
    
    return res.status(500).json({
      success: false,
      response_text: {
        main: userFriendlyMessage,
        follow_up: "What would you like to try next?"
      },
      interactive_elements: {
        followup_buttons: ["Try again", "Ask something else"],
        learn_more: { topic: "" },
        story_button: { prompt: "" }
      },
      content_blocks: {
        safety_filter: false
      },
      chatId: req.body?.chatId || 'unknown',
      gradeLevel: req.body?.gradeLevel || 3,
      error: errorMessage
    });
  }
}