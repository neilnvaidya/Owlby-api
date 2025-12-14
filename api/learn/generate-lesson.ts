import { logLessonCall, flushApiLogger } from '../../lib/api-logger';
import { lessonResponseSchema } from '../../lib/ai-schemas';
import { getLessonInstructions } from '../../lib/ai-instructions';
import { 
  handleCORS, 
  processAIRequest, 
  normalizeAchievementTags, 
  createErrorResponse 
} from '../../lib/api-handler';
import { verifySupabaseToken } from '../../lib/auth-supabase';
import { checkRateLimit } from '../../lib/rate-limit';

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
    decoded = await verifySupabaseToken(token);
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      userMessage: 'Session expired. Please sign in again.',
    });
  }

  const userId = decoded?.id || 'unknown';
  const { topic, gradeLevel = 3, tags } = req.body;
  const contextTags = Array.isArray(tags) ? tags : [];
  
  // Validate required parameters
  if (!topic) {
    logLessonCall({
      userId,
      gradeLevel,
      topic: topic || 'unknown',
      responseTimeMs: Date.now() - startTime,
      success: false,
      error: 'BadRequest',
      model: 'unknown',
    });
    await flushApiLogger();
    
    return res.status(400).json({
      success: false,
      error: "Please provide a topic for the lesson.",
      userMessage: "Please provide a topic for the lesson.",
      topic: topic || null
    });
  }

  // Basic per-user rate limiting to reduce spamming
  const rate = checkRateLimit(`lesson:${userId}`, 8, 60 * 1000);
  if (!rate.allowed) {
    return res.status(429).json({
      success: false,
      error: "Too many requests",
      userMessage: "I'm preparing lots of lessons right now. Let's pause for a moment.",
      retryAfterMs: rate.retryAfterMs,
    });
  }

  try {
    // Build system instructions
    const systemInstructions = getLessonInstructions(topic, gradeLevel, contextTags);
    
    // Create contents for AI request
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: `topic = ${topic}, grade ${gradeLevel}, age ${gradeLevel + 5}`,
          },
        ],
      },
    ];
    
    // Process AI request using centralized handler with retry and fallback
    const { responseText, usageMetadata, modelUsed, fallbackUsed } = await processAIRequest(
      lessonResponseSchema,
      systemInstructions,
      contents,
      'lesson',
      topic
    );
    
    // Process the lesson response
    const processedResponse = processLessonResponse(responseText, topic, gradeLevel);
    
    // Normalize achievement tags
    normalizeAchievementTags(processedResponse);

    // Log successful request
    logLessonCall({
      userId,
      gradeLevel,
      topic,
      responseText,
      responseTimeMs: Date.now() - startTime,
      success: true,
      usageMetadata,
      model: modelUsed,
    });
    await flushApiLogger();
    
    // Always include success flag
    return res.status(200).json({
      ...processedResponse,
      success: true
    });
    
  } catch (error: any) {
    // Log failed request
    logLessonCall({
      userId,
      gradeLevel,
      topic,
      responseTimeMs: Date.now() - startTime,
      success: false,
      error: error.message || 'UnknownError',
      model: 'unknown',
    });
    await flushApiLogger();

    // Create standardized error response
    const errorResponse = createErrorResponse(error, 'lesson', { 
      topic: req.body?.topic 
    });
    
    return res.status(errorResponse.status === 200 ? 500 : errorResponse.status).json(errorResponse.body);
  }
}