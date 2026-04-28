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
import { resolveWikimediaImage } from '../../lib/wikimedia-image.js';

/**
 * Legacy lesson route archived to unused_store_do_not_delete.
 * Replaced in production by lesson-v3 flow.
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
        requiredCategoryTags: lesson.requiredCategoryTags || [],
        optionalTags: lesson.optionalTags || [],
      };
    } else {
      throw new Error('Invalid lesson JSON structure');
    }
  } catch (error) {
    console.error('Failed to parse lesson JSON response:', error);
    throw new Error('Failed to generate lesson: Invalid response format. Please try again.');
  }
}

export default async function handler(req: any, res: any) {
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
      userMessage:
        gate.reason === 'daily_limit_reached'
          ? "You've reached your daily limit. Upgrade for unlimited access."
          : 'A subscription is required for this feature.',
    });
  }

  const { topic, gradeLevel = 3, tags } = req.body;
  const contextTags = Array.isArray(tags) ? tags : [];

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
      error: 'Please provide a topic for the lesson.',
      userMessage: 'Please provide a topic for the lesson.',
      topic: topic || null,
    });
  }

  const rate = checkRateLimit(`lesson:${userId}`, 8, 60 * 1000);
  if (!rate.allowed) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      userMessage: "I'm preparing lots of lessons right now. Let's pause for a moment.",
      retryAfterMs: rate.retryAfterMs,
    });
  }

  let modelUsed = 'unknown';
  let fallbackUsed = false;

  try {
    const systemInstructions = getLessonInstructions(topic, gradeLevel, contextTags);
    const contents = [
      {
        role: 'user',
        parts: [{ text: `topic = ${topic}, grade ${gradeLevel}, age ${gradeLevel + 5}` }],
      },
    ];

    const aiStart = Date.now();
    const { responseText, usageMetadata, modelUsed: usedModel, fallbackUsed: usedFallback } =
      await processAIRequest(lessonResponseSchema, systemInstructions, contents, 'lesson', topic);
    modelUsed = usedModel;
    fallbackUsed = usedFallback;
    aiDurationMs = Date.now() - aiStart;
    timing.aiMs = aiDurationMs;

    const processedResponse = processLessonResponse(responseText, topic, gradeLevel);
    normalizeAchievementTags(processedResponse);
    const image = await resolveWikimediaImage({
      requiredCategoryTags: processedResponse.requiredCategoryTags,
      optionalTags: processedResponse.optionalTags,
      topic,
      fallbackQuery: topic,
      maxQueries: 2,
    });

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

    return res.status(200).json({ ...processedResponse, image, success: true });
  } catch (error: any) {
    console.info('[LESSON API][ARCHIVED] Timing', {
      totalMs: Date.now() - startTime,
      authMs: (req as any)._authDurationMs ?? 0,
      aiMs: aiDurationMs,
      modelUsed,
      fallbackUsed,
      ...timing,
      error: error.message,
    });
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
    const errorResponse = createErrorResponse(error, 'lesson', { topic: req.body?.topic });
    return res.status(errorResponse.status).json(errorResponse.body);
  }
}
