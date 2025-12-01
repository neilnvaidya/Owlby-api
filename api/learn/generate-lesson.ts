import { logLessonCall, flushApiLogger } from '../../lib/api-logger';
import { lessonResponseSchema } from '../../lib/ai-schemas';
import { getLessonInstructions } from '../../lib/ai-instructions';
import { buildAIConfig, MODEL_NAME } from '../../lib/ai-config';
import { 
  handleCORS, 
  processAIRequest, 
  normalizeAchievementTags, 
  createErrorResponse 
} from '../../lib/api-handler';

/**
 * Attempt to repair truncated JSON by removing incomplete fields
 */
function repairTruncatedJSON(jsonString: string): string {
  // Remove trailing whitespace
  let cleaned = jsonString.trim();
  
  // If it doesn't end with }, try to close it properly
  if (!cleaned.endsWith('}')) {
    // Find the last complete property
    // Look for patterns like "key": "value" or "key": { ... }
    // Remove anything after the last complete property
    
    // Try to find and remove incomplete visual object
    const visualMatch = cleaned.match(/"visual"\s*:\s*\{[^}]*$/);
    if (visualMatch) {
      // Remove the incomplete visual field
      cleaned = cleaned.substring(0, visualMatch.index);
      // Remove trailing comma if present
      cleaned = cleaned.replace(/,\s*$/, '');
      // Close the lesson object
      cleaned += '\n    }';
    }
    
    // Close the root object if needed
    if (!cleaned.endsWith('}')) {
      cleaned += '\n  }';
    }
  }
  
  return cleaned;
}

/**
 * Process the JSON response from lesson generation API
 * Handles truncated responses from MAX_TOKENS by attempting to repair incomplete JSON
 */
function processLessonResponse(responseText: string, topic: string, gradeLevel: number, rawResponse?: any) {
  // Check if response was truncated
  const wasTruncated = rawResponse?.candidates?.[0]?.finishReason === 'MAX_TOKENS';
  
  if (wasTruncated) {
    console.warn('📚 [lesson] WARNING: Response was truncated (MAX_TOKENS). Attempting to repair JSON...');
    console.warn('📚 [lesson] Response length:', responseText.length);
    console.warn('📚 [lesson] Last 200 chars:', responseText.slice(-200));
  }
  
  let jsonResponse: any;
  let parseAttempts = 0;
  
  try {
    // First attempt: direct parse
    jsonResponse = JSON.parse(responseText);
    parseAttempts = 1;
  } catch (parseError: any) {
    console.warn('📚 [lesson] Initial JSON parse failed:', {
      error: parseError.message,
      position: parseError.message.match(/position (\d+)/)?.[1],
      responseLength: responseText.length
    });
    
    if (wasTruncated) {
      // Try to repair truncated JSON
      try {
        const repaired = repairTruncatedJSON(responseText);
        console.info('📚 [lesson] Attempting to parse repaired JSON...');
        console.info('📚 [lesson] Repaired JSON length:', repaired.length);
        console.info('📚 [lesson] Repaired JSON last 200 chars:', repaired.slice(-200));
        
        jsonResponse = JSON.parse(repaired);
        parseAttempts = 2;
        console.info('📚 [lesson] Successfully parsed repaired JSON');
      } catch (repairError: any) {
        console.error('📚 [lesson] Failed to repair JSON:', {
          error: repairError.message,
          position: repairError.message.match(/position (\d+)/)?.[1]
        });
        
        // Last resort: try to extract what we can using regex
        try {
          const titleMatch = responseText.match(/"title"\s*:\s*"([^"]+)"/);
          const introMatch = responseText.match(/"introduction"\s*:\s*"([^"]+)"/);
          const bodyMatch = responseText.match(/"body"\s*:\s*\[([^\]]+)\]/);
          const conclusionMatch = responseText.match(/"conclusion"\s*:\s*"([^"]+)"/);
          
          if (titleMatch || introMatch) {
            console.warn('📚 [lesson] Attempting partial extraction from truncated JSON');
            // Create a minimal valid structure
            jsonResponse = {
              lesson: {
                title: titleMatch?.[1] || 'Lesson',
                introduction: introMatch?.[1] || 'This lesson was truncated.',
                body: bodyMatch ? bodyMatch[1].split(',').map((s: string) => s.trim().replace(/^"|"$/g, '')) : ['Content was truncated due to length limits.'],
                conclusion: conclusionMatch?.[1] || 'This lesson was incomplete.',
                keyPoints: [],
                keywords: [],
                challengeQuiz: [],
                difficulty: 10
              }
            };
            parseAttempts = 3;
          } else {
            throw repairError;
          }
        } catch (extractError) {
          console.error('📚 [lesson] All JSON parsing attempts failed');
          throw new Error(`Failed to parse lesson JSON: Response was truncated and could not be repaired. Original error: ${parseError.message}`);
        }
      }
    } else {
      // Not truncated, so this is a real parsing error
      throw new Error(`Failed to parse lesson JSON: ${parseError.message}`);
    }
  }
  
  if (jsonResponse.lesson) {
    const lesson = jsonResponse.lesson;
    
    // Log if we had to repair
    if (parseAttempts > 1) {
      console.warn('📚 [lesson] Used repaired/partial JSON. Some fields may be missing.');
    }
    
    return {
      topic: topic,
      gradeLevel: gradeLevel,
      title: lesson.title || 'Lesson',
      introduction: (lesson.introduction || '').replace(/\\n/g, '\n'),
      body: (lesson.body || []).map((p: string) => String(p).replace(/\\n/g, '\n')),
      conclusion: lesson.conclusion || '',
      keyPoints: lesson.keyPoints || [],
      keywords: lesson.keywords || [],
      challengeQuiz: {
        questions: lesson.challengeQuiz || []
      },
      tags: lesson.tags || [],
      difficulty: lesson.difficulty ?? 10,
      // Optional CSS-based visual representation - set to null if incomplete
      visual: (lesson.visual && lesson.visual.type && lesson.visual.title) ? lesson.visual : null,
      // Include normalized achievement tags
      requiredCategoryTags: lesson.requiredCategoryTags || [],
      optionalTags: lesson.optionalTags || []
    };
  } else {
    throw new Error('Invalid lesson JSON structure: missing "lesson" key');
  }
}

export default async function handler(req: any, res: any) {
  // Handle CORS and validate request method
  if (!handleCORS(req, res)) return;

  const startTime = Date.now();
  const { topic, gradeLevel = 3, userId } = req.body;
  
  // Validate required parameters
  if (!topic) {
    console.info('❌ Missing topic');
    
    logLessonCall({
      userId,
      gradeLevel,
      topic: topic || 'unknown',
      responseTimeMs: Date.now() - startTime,
      success: false,
      error: 'BadRequest',
      model: MODEL_NAME,
    });
    await flushApiLogger();
    
    return res.status(400).json({ error: "Topic is required." });
  }

  try {
    console.info('📚 [lesson] ========== REQUEST START ==========');
    console.info('📚 [lesson] Request received for topic:', topic);
    console.info('📚 [lesson] REQUEST BODY:', JSON.stringify({
      topic,
      gradeLevel,
      userId: userId?.substring(0, 8) + '...'
    }, null, 2));
    
    // Build system instructions
    const systemInstructions = getLessonInstructions(topic, gradeLevel);

    // Build AI configuration with higher token limit for lessons (they can be longer)
    const config = buildAIConfig(lessonResponseSchema, systemInstructions, 8192); // Increased from default 4096
    
    // Create contents for AI request
    const userPrompt = `topic = ${topic}, grade ${gradeLevel}, age ${gradeLevel + 5}`;
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: userPrompt,
          },
        ],
      },
    ];
    
    console.info('📚 [lesson] SYSTEM INSTRUCTIONS LENGTH:', systemInstructions.length);
    console.info('📚 [lesson] USER PROMPT:', userPrompt);
    
    // Process AI request using centralized handler
    const { responseText, usageMetadata, rawResponse } = await processAIRequest(
      config, 
      contents, 
      'lesson', 
      topic
    );
    
    // Log full raw response
    console.info('🔍 [lesson] FULL RAW RESPONSE OBJECT:', JSON.stringify(rawResponse, null, 2));
    
    // Check for truncation
    const finishReason = rawResponse?.candidates?.[0]?.finishReason;
    if (finishReason === 'MAX_TOKENS') {
      console.warn('📚 [lesson] WARNING: Response was truncated due to MAX_TOKENS limit');
      console.warn('📚 [lesson] Consider reducing maxOutputTokens or simplifying the lesson schema');
    }
    
    // Process the lesson response (pass rawResponse for truncation detection)
    const processedResponse = processLessonResponse(responseText, topic, gradeLevel, rawResponse);
    
    // Normalize achievement tags
    normalizeAchievementTags(processedResponse);

    // Log processed response
    console.info('🔍 [lesson] PROCESSED RESPONSE:', JSON.stringify(processedResponse, null, 2));

    // Log successful request (don't await flush to avoid blocking)
    logLessonCall({
      userId,
      gradeLevel,
      topic,
      responseText,
      responseTimeMs: Date.now() - startTime,
      success: true,
      usageMetadata,
      model: MODEL_NAME,
    });
    // Flush in background to avoid blocking response
    flushApiLogger().catch(err => {
      console.error('📚 [lesson] Error flushing logs:', err);
    });

    const totalMs = Date.now() - startTime;
    console.info('✅ [lesson] ========== REQUEST COMPLETE ==========');
    console.info(`✅ [lesson] Successfully generated lesson for topic: ${topic} (${totalMs}ms total)`);
    console.info('📤 [lesson] FULL RESPONSE BEING SENT:', JSON.stringify(processedResponse, null, 2));
    
    return res.status(200).json(processedResponse);
    
  } catch (error: any) {
    const totalMs = Date.now() - startTime;
    console.error('📚 [lesson] ========== REQUEST ERROR ==========');
    console.error(`📚 [lesson] Error after ${totalMs}ms:`, {
      error: error.message || 'UnknownError',
      stack: error.stack,
      name: error.name,
      topic: req.body?.topic
    });
    
    // Log failed request (don't await flush)
    logLessonCall({
      userId,
      gradeLevel,
      topic,
      responseTimeMs: totalMs,
      success: false,
      error: error.message || 'UnknownError',
      model: MODEL_NAME,
    });
    // Flush in background
    flushApiLogger().catch(err => {
      console.error('📚 [lesson] Error flushing logs:', err);
    });

    // Check for timeout specifically
    if (error.message && error.message.includes('Timeout')) {
      console.error('📚 [lesson] TIMEOUT DETECTED - AI request took too long');
      return res.status(504).json({
        error: 'Request timeout',
        message: 'The lesson generation took too long. Please try again with a simpler topic.',
        details: `Request exceeded ${totalMs}ms`
      });
    }

    // Create standardized error response
    const errorResponse = createErrorResponse(error, 'lesson', { 
      topic: req.body?.topic 
    });
    
    return res.status(errorResponse.status).json(errorResponse.body);
  }
}