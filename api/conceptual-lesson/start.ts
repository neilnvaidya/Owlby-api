/**
 * POST /api/conceptual-lesson/start
 *
 * Fires once per conceptual lesson. Classifies the topic, plans chunks,
 * generates the S1 hook + S2 prior-knowledge probe, returns initial state.
 *
 * Request: { student_request: string, student_age: number }
 */

import { logLessonCall, flushApiLogger } from '../../lib/api-logger.js';
import { conceptualLessonResponseSchema } from '../../lib/conceptual-lesson-schemas.js';
import { buildInstructionSetA } from '../../lib/conceptual-lesson-instructions.js';
import {
  handleCORS,
  processAIRequest,
  createErrorResponse,
} from '../../lib/api-handler.js';
import { verifySupabaseToken } from '../../lib/auth-supabase.js';
import { checkRateLimit } from '../../lib/rate-limit.js';
import { canGenerate } from '../../lib/subscription-gate.js';
import { incrementDailyUsage } from '../../lib/usage-daily.js';
import {
  getAgeBand,
  type ConceptualLessonStartRequest,
} from '../../lib/conceptual-lesson-types.js';
import {
  getTurnBudget,
  getChunksPlanned,
  getChunkLabels,
  validateAIResponse,
} from '../../lib/conceptual-lesson-helpers.js';

const ENDPOINT = 'conceptual-lesson';

export default async function handler(req: any, res: any) {
  if (!handleCORS(req, res)) return;

  const startTime = Date.now();

  // --- Auth ---
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
  } catch {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      userMessage: 'Session expired. Please sign in again.',
    });
  }

  const userId = decoded?.id || 'unknown';

  // --- Subscription gate ---
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

  // --- Validate body ---
  const { student_request, student_age } = req.body as Partial<ConceptualLessonStartRequest>;

  if (!student_request || typeof student_request !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'student_request is required',
      userMessage: 'Please tell me what you want to learn about.',
    });
  }

  const age = typeof student_age === 'number' && student_age >= 5 && student_age <= 18
    ? student_age
    : 10; // default fallback

  // --- Rate limit ---
  const rate = checkRateLimit(`conceptual-lesson:${userId}`, 6, 60_000);
  if (!rate.allowed) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      userMessage: "Let's pause for a moment before starting another lesson.",
      retryAfterMs: rate.retryAfterMs,
    });
  }

  let modelUsed = 'unknown';

  try {
    // --- Plan the lesson ---
    const turnBudget = getTurnBudget(age);
    const chunksPlanned = getChunksPlanned(age);
    const chunkLabels = getChunkLabels(chunksPlanned);

    // --- Build AI instructions ---
    const systemInstruction = buildInstructionSetA(
      student_request,
      age,
      chunksPlanned,
      chunkLabels,
      turnBudget,
    );

    const contents = [
      {
        role: 'user',
        parts: [{ text: `I want to learn about: ${student_request}` }],
      },
    ];

    // --- AI call with validation retry ---
    const MAX_RETRIES = 2;
    let parsed: any = null;
    let lastResponseText = '';
    let lastUsageMetadata: any = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const { responseText, usageMetadata, modelUsed: usedModel } = await processAIRequest(
        conceptualLessonResponseSchema,
        systemInstruction,
        contents,
        ENDPOINT,
        student_request,
        4096,
      );
      modelUsed = usedModel;
      lastResponseText = responseText;
      lastUsageMetadata = usageMetadata;

      let candidate: any;
      try {
        candidate = JSON.parse(responseText);
      } catch {
        if (attempt === MAX_RETRIES) throw new Error('AI returned malformed JSON after retries');
        continue;
      }

      const validation = validateAIResponse(candidate);
      if (validation.valid) {
        parsed = candidate;
        break;
      }

      console.warn(`[CONCEPTUAL-LESSON /start] Validation failed, attempt ${attempt + 1}`, validation.errors);
      if (attempt === MAX_RETRIES) {
        throw new Error(
          `AI returned invalid response after retries: ${validation.errors.join('; ')}`,
        );
      }
    }

    if (!parsed) throw new Error('AI_PROCESSING_FAILED: no valid response after retries');

    console.info(`[CONCEPTUAL-LESSON /start] Success`, {
      topic: parsed.lesson_state?.topic,
      age,
      chunks: chunksPlanned,
      turnBudget,
      model: modelUsed,
      durationMs: Date.now() - startTime,
    });

    // --- Log & usage ---
    logLessonCall({
      userId,
      gradeLevel: Math.max(1, age - 5),
      topic: student_request,
      responseText: lastResponseText,
      responseTimeMs: Date.now() - startTime,
      success: true,
      usageMetadata: lastUsageMetadata,
      model: modelUsed,
    });
    void flushApiLogger();
    await incrementDailyUsage(userId, 'lesson');

    return res.status(200).json({ ...parsed, success: true });
  } catch (error: any) {
    console.error(`[CONCEPTUAL-LESSON /start] Failed`, {
      error: error.message,
      age,
      topic: student_request,
      durationMs: Date.now() - startTime,
    });

    logLessonCall({
      userId,
      gradeLevel: Math.max(1, age - 5),
      topic: student_request,
      responseTimeMs: Date.now() - startTime,
      success: false,
      error: error.message || 'UnknownError',
      model: modelUsed,
    });
    void flushApiLogger();

    const errorResponse = createErrorResponse(error, ENDPOINT, {
      topic: student_request,
    });
    return res.status(errorResponse.status).json(errorResponse.body);
  }
}
