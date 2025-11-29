import { logChatCall, flushApiLogger } from '../../lib/api-logger';

import { chatResponseSchema } from '../../lib/ai-schemas';
import { getChatInstructions } from '../../lib/ai-instructions';
import { buildAIConfig } from '../../lib/ai-config';
import { 
  handleCORS, 
  processAIRequest, 
  normalizeAchievementTags, 
  createErrorResponse 
} from '../../lib/api-handler';

// Toggle Supabase API logging
const ENABLE_API_LOGGING = false;

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
            prompt: "Explore this topic further",
            tags: ["learning", "education"]
          },
          story_button: {
            title: "Story Time!",
            story_prompt: "Tell me a fun story about this topic"
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
  // Handle CORS and validate request method
  if (!handleCORS(req, res)) return;

  const startTime = Date.now();
  let aiDurationMs = 0;

  const { messages, chatId, gradeLevel = 3, userId, sessionMemory } = req.body;

  // Validate required parameters
  if (!messages || !Array.isArray(messages) || messages.length === 0 || !chatId) {
    console.info('❌ Missing messages array or chatId');
    
    if (ENABLE_API_LOGGING) {
      logChatCall({
        userId,
        chatId: chatId || 'unknown',
        gradeLevel,
        message: '[multi-turn]',
        responseTimeMs: Date.now() - startTime,
        success: false,
        error: 'BadRequest',
        model: 'gemini-2.5-flash',
      });
      await flushApiLogger();
    }
    
    return res.status(400).json({ 
      error: "'messages' (array) and 'chatId' are required.",
      chatId: chatId || 'unknown'
    });
  }

  try {
    const previewMsg = messages && messages.length > 0 
      ? (messages[0].text?.slice(0, 60) + (messages[0].text?.length > 60 ? '…' : '')) 
      : '';
    
    console.info(`🦉 [chat] req chatId=${chatId} turns=${messages?.length ?? 0} firstPrompt="${previewMsg}"`);

    // Build system instructions using existing utility
    const recentContext = messages
      .slice(0, 3)
      .map((m: any, idx: number) => `${idx + 1}. ${m.role === 'user' ? 'User' : 'Owlby'}: "${m.text.slice(0, 100)}${m.text.length > 100 ? '…' : ''}"`)
      .join('\n');

    const systemInstructions = getChatInstructions(gradeLevel, recentContext);
    
    // Build AI configuration
    const config = buildAIConfig(chatResponseSchema, systemInstructions);
    
    // Create contents for AI request
    const lastUserMessage = messages.filter((m: any) => m.role === 'user').slice(-1)[0]?.text || '';
    const contents = [
      {
        role: 'user',
        parts: [{ text: lastUserMessage }],
      },
    ];

    let processedResponse: any;

    try {
      const aiStart = Date.now();
      
      // Process AI request using centralized handler
      const { responseText, usageMetadata } = await processAIRequest(
        config, 
        contents, 
        'chat', 
        lastUserMessage
      );
      
      aiDurationMs = Date.now() - aiStart;
      
      // Process complete response
      processedResponse = processResponse(responseText, '[multi-turn]', gradeLevel, chatId);
      
      // Normalize achievement tags
      normalizeAchievementTags(processedResponse);

      if (ENABLE_API_LOGGING) {
        logChatCall({
          userId,
          chatId,
          gradeLevel,
          message: '[multi-turn]',
          responseText,
          responseTimeMs: Date.now() - startTime,
          success: true,
          usageMetadata,
          model: 'gemini-2.5-flash',
        });
        await flushApiLogger();
      }

    } catch (aiError: any) {
      if (ENABLE_API_LOGGING) {
        logChatCall({
          userId,
          chatId,
          gradeLevel,
          message: '[multi-turn]',
          responseTimeMs: Date.now() - startTime,
          success: false,
          error: aiError.message || 'UnknownError',
          model: 'gemini-2.5-flash',
        });
        await flushApiLogger();
      }

      // Handle specific AI errors with fallback responses
      if (aiError.message === 'SERVICE_UNAVAILABLE_REGION') {
        processedResponse = {
          response_text: {
            main: "Hoot hoot! I'm sorry, but I'm not available in your region at the moment. Is there anything else I can help you with?"
          },
          interactive_elements: {
            followup_buttons: ["Try again", "Ask something else"],
            learn_more: { prompt: "", tags: [] },
            story_button: { title: "", story_prompt: "" }
          }
        };
      } else {
        processedResponse = {
          response_text: {
            main: "Hoo-hoo! I'm having trouble processing your request right now. Can you try asking something else?"
          },
          interactive_elements: {
            followup_buttons: ["Try again", "Ask something else"],
            learn_more: { prompt: "", tags: [] },
            story_button: { title: "", story_prompt: "" }
          }
        };
      }
    }

    const totalMs = Date.now() - startTime;
    console.info(`✅ [chat] done chatId=${chatId} ok=${processedResponse?.success ?? true} total=${totalMs}ms (AI ${aiDurationMs}ms)`);
    
    // Log full response being sent to client (for debugging truncation issues)
    const mainTextLen = processedResponse?.response_text?.main?.length ?? 0;
    const followUpLen = processedResponse?.response_text?.follow_up?.length ?? 0;
    console.info(`📤 [chat] SENDING response: main=${mainTextLen} chars, follow_up=${followUpLen} chars`);
    console.info(`📤 [chat] FULL_MAIN_TEXT:`, processedResponse?.response_text?.main);
    console.info(`📤 [chat] FULL_FOLLOW_UP:`, processedResponse?.response_text?.follow_up);
    
    if (ENABLE_API_LOGGING) {
      await flushApiLogger();
    }
    
    return res.status(200).json(processedResponse);

  } catch (error: any) {
    if (ENABLE_API_LOGGING) {
      logChatCall({
        userId,
        chatId,
        gradeLevel,
        message: '[multi-turn]',
        responseTimeMs: Date.now() - startTime,
        success: false,
        error: error.message || 'UnknownApiError',
        model: 'gemini-2.5-flash',
      });
      await flushApiLogger();
    }

    const errorResponse = createErrorResponse(error, 'chat', { 
      chatId: req.body?.chatId,
      success: false 
    });
    
    return res.status(errorResponse.status).json(errorResponse.body);
  }
}