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
 * Process the JSON response from lesson generation API
 * No truncation applied - AI schema and instructions constrain output sizes appropriately
 */
function processLessonResponse(responseText: string, topic: string, gradeLevel: number) {
  try {
    const jsonResponse = JSON.parse(responseText);
    
    if (jsonResponse.lesson) {
      const lesson = jsonResponse.lesson;
      return {
        topic: topic,
        gradeLevel: gradeLevel,
        title: lesson.title,
        introduction: lesson.introduction.replace(/\\n/g, '\n'),
        body: (lesson.body || []).map((p: string) => p.replace(/\\n/g, '\n')),
        conclusion: lesson.conclusion,
        keyPoints: lesson.keyPoints || [],
        keywords: lesson.keywords || [],
        challengeQuiz: {
          questions: lesson.challengeQuiz || []
        },
        tags: lesson.tags || [],
        difficulty: lesson.difficulty ?? 10,
        // Optional CSS-based visual representation, passed through for clients that support it
        visual: lesson.visual || null,
        // Include normalized achievement tags
        requiredCategoryTags: lesson.requiredCategoryTags || [],
        optionalTags: lesson.optionalTags || []
      };
    } else {
      throw new Error('Invalid lesson JSON structure');
    }
  } catch (error) {
    console.error('Failed to parse lesson JSON response:', error);
    throw new Error(`Failed to generate lesson: Invalid response format. Please try again.`);
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

    // Build AI configuration
    const config = buildAIConfig(lessonResponseSchema, systemInstructions);
    
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
    
    // Process the lesson response
    const processedResponse = processLessonResponse(responseText, topic, gradeLevel);
    
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