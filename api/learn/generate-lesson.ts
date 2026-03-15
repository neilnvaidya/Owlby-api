import { logLessonCall, flushApiLogger } from '../../lib/api-logger.js';
import { lessonResponseSchema } from '../../lib/ai-schemas.js';
import { getLessonInstructions } from '../../lib/ai-instructions.js';
import {
  handleCORS,
  processAIRequest,
  normalizeAchievementTags,
  createErrorResponse,
} from '../../lib/api-handler.js';
import { verifySupabaseToken } from '../../lib/auth-supabase.js';
import { checkRateLimit } from '../../lib/rate-limit.js';
import { canGenerate } from '../../lib/subscription-gate.js';
import { incrementDailyUsage } from '../../lib/usage-daily.js';

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
          questions: Array.isArray(lesson.challengeQuiz?.questions)
            ? lesson.challengeQuiz.questions
            : Array.isArray(lesson.challengeQuiz)
              ? lesson.challengeQuiz
              : [],
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
  const authStart = Date.now();
  try {
    decoded = await verifySupabaseToken(token);
    mark('authMs', authStart);
    (req as any)._authDurationMs = Date.now() - authStart;
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      userMessage: 'Session expired. Please sign in again.',
    });
  }

  const userId = decoded?.id || 'unknown';

  const gate = await canGenerate(userId, 'lesson');
  if (!gate.allowed) {
    return res.status(403).json({
      success: false,
      code: gate.reason,
      userMessage: gate.reason === 'daily_limit_reached'
        ? "You've reached your daily limit. Upgrade for unlimited access."
        : 'A subscription is required for this feature.',
    });
  }

  const { topic, gradeLevel = 3, tags } = req.body;
  const contextTags = Array.isArray(tags) ? tags : [];
  
  console.log('[LESSON API] Request received:', {
    userId,
    topic,
    gradeLevel,
    tags,
    tagsType: typeof tags,
    tagsIsArray: Array.isArray(tags),
    contextTagsCount: contextTags.length,
    contextTags,
  });
  
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
    void flushApiLogger();
    
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

  let modelUsed = 'unknown';
  let fallbackUsed = false;
  let wasSuccessful = true;

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
    const aiStart = Date.now();
    const { responseText, usageMetadata, modelUsed: usedModel, fallbackUsed: usedFallback } = await processAIRequest(
      lessonResponseSchema,
      systemInstructions,
      contents,
      'lesson',
      topic
    );
    modelUsed = usedModel;
    fallbackUsed = usedFallback;
    aiDurationMs = Date.now() - aiStart;
    timing.aiMs = aiDurationMs;
    
    // Process the lesson response
    const processedResponse = processLessonResponse(responseText, topic, gradeLevel);
    
    // Normalize achievement tags
    normalizeAchievementTags(processedResponse);

    // Log timing (aligned with chat route)
    console.info('[LESSON API] Timing summary', {
      totalMs: Date.now() - startTime,
      authMs: (req as any)._authDurationMs ?? 0,
      aiMs: aiDurationMs,
      modelUsed,
      fallbackUsed,
      userId,
      topic,
      success: true,
    });
    console.info('[LESSON API] Timing breakdown', {
      totalMs: Date.now() - startTime,
      ...timing,
      modelUsed,
      fallbackUsed,
      success: true,
    });

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
    void flushApiLogger();

    await incrementDailyUsage(userId, 'lesson');

    return res.status(200).json({
      ...processedResponse,
      success: true
    });
    
  } catch (error: any) {
    wasSuccessful = false;
    // Log timing on failure
    console.info('[LESSON API] Timing summary', {
      totalMs: Date.now() - startTime,
      authMs: (req as any)._authDurationMs ?? 0,
      aiMs: aiDurationMs,
      modelUsed,
      fallbackUsed,
      userId,
      topic: req.body?.topic,
      success: false,
      error: error.message,
    });
    console.info('[LESSON API] Timing breakdown', {
      totalMs: Date.now() - startTime,
      ...timing,
      modelUsed,
      fallbackUsed,
      success: false,
      error: error.message,
    });
    // Log failed request
    logLessonCall({
      userId,
      gradeLevel,
      topic,
      responseTimeMs: Date.now() - startTime,
      success: false,
      error: error.message || 'UnknownError',
      model: modelUsed,
    });
    void flushApiLogger();

    // Create standardized error response
    const errorResponse = createErrorResponse(error, 'lesson', { 
      topic: req.body?.topic 
    });
    
    return res.status(errorResponse.status).json(errorResponse.body);
  }
}