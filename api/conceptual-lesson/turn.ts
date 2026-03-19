/**
 * POST /api/conceptual-lesson/turn
 *
 * Fires once per student response. Handles all beat transitions.
 * Returns the next message with updated lesson_state.
 *
 * Request: { student_response, lesson_state, conversation_history }
 */

import { logLessonCall, flushApiLogger } from '../../lib/api-logger.js';
import { conceptualLessonResponseSchema } from '../../lib/conceptual-lesson-schemas.js';
import { buildTurnSystemPrompt } from '../../lib/conceptual-lesson-instructions.js';
import {
  handleCORS,
  processAIRequest,
  createErrorResponse,
} from '../../lib/api-handler.js';
import { verifySupabaseToken } from '../../lib/auth-supabase.js';
import { checkRateLimit } from '../../lib/rate-limit.js';
import {
  MQ_CONTINUE_SENTINEL,
  type ConceptualLessonTurnRequest,
  type ConceptualLessonState,
  type ConceptualLessonResponse,
} from '../../lib/conceptual-lesson-types.js';
import {
  formatConversationForGemini,
  isBudgetExhausted,
  validateAIResponse,
  normalizeConceptualLessonResponse,
} from '../../lib/conceptual-lesson-helpers.js';

const ENDPOINT = 'conceptual-lesson';

/**
 * When the student sends __mq_continue__, we close MQ and run M6 without
 * calling the AI for the MQ phase. Instead we build an M6-advancing prompt.
 */
function buildMQContinueState(state: ConceptualLessonState): ConceptualLessonState {
  return {
    ...state,
    mq_questions_asked: 0,
    // Keep beat as MQ — the AI prompt will handle M6 advance
  };
}

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

  // --- Rate limit ---
  const rate = checkRateLimit(`conceptual-lesson:${userId}`, 30, 60_000);
  if (!rate.allowed) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      userMessage: "Let's slow down a bit. Try again in a moment.",
      retryAfterMs: rate.retryAfterMs,
    });
  }

  // --- Validate body ---
  const { student_response, lesson_state, conversation_history } =
    req.body as Partial<ConceptualLessonTurnRequest>;

  if (!lesson_state || !conversation_history) {
    return res.status(400).json({
      success: false,
      error: 'lesson_state and conversation_history are required',
      userMessage: 'Something went wrong. Please try again.',
    });
  }

  if (typeof student_response !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'student_response is required',
      userMessage: 'Please provide a response.',
    });
  }

  let modelUsed = 'unknown';

  try {
    // --- Handle __mq_continue__ sentinel ---
    const isMQContinue = student_response === MQ_CONTINUE_SENTINEL;
    let effectiveState = lesson_state as ConceptualLessonState;
    let effectiveStudentResponse = student_response;

    if (isMQContinue) {
      effectiveState = buildMQContinueState(effectiveState);
      effectiveStudentResponse = 'The student chose to continue without asking questions. Close the MQ phase, run M6 advance decision, and proceed.';
    }

    // --- Build system prompt ---
    const overview = effectiveState.overview;
    const systemInstruction = buildTurnSystemPrompt(effectiveState, overview);

    // --- Build conversation contents for Gemini ---
    const contents = formatConversationForGemini(
      conversation_history,
      effectiveStudentResponse,
    );

    // --- AI call with validation retry (max 2 retries) ---
    const MAX_RETRIES = 2;
    let parsed: ConceptualLessonResponse | null = null;
    let lastResponseText = '';
    let lastUsageMetadata: any = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const { responseText, usageMetadata, modelUsed: usedModel } = await processAIRequest(
        conceptualLessonResponseSchema,
        systemInstruction,
        contents,
        ENDPOINT,
        effectiveStudentResponse,
        4096,
      );
      modelUsed = usedModel;
      lastResponseText = responseText;
      lastUsageMetadata = usageMetadata;

      let candidate: any;
      try {
        candidate = JSON.parse(responseText);
      } catch {
        console.warn(`[CONCEPTUAL-LESSON /turn] Malformed JSON, attempt ${attempt + 1}`);
        if (attempt === MAX_RETRIES) throw new Error('AI returned malformed JSON after retries');
        continue;
      }

      // Debug: log the MCQ shape the model returned.
      if (candidate?.question_type === 'mcq') {
        const mo = candidate.mcq_options;
        const moType = Array.isArray(mo) ? 'array' : mo === null ? 'null' : typeof mo;
        console.info('[CONCEPTUAL-LESSON /turn] mcq_options debug', {
          beatIn: lesson_state.beat,
          attempt: attempt + 1,
          question_type: candidate.question_type,
          mcq_options_type: moType,
          mcq_options_len: Array.isArray(mo) ? mo.length : undefined,
          mcq_options_preview:
            typeof mo === 'string'
              ? mo.slice(0, 160)
              : Array.isArray(mo)
                ? mo
                : mo,
        });
      }

      const normalized = normalizeConceptualLessonResponse(
        candidate,
        lesson_state as ConceptualLessonState,
      );

      const validation = validateAIResponse(
        normalized,
        lesson_state as ConceptualLessonState,
      );
      if (validation.valid) {
        parsed = normalized as ConceptualLessonResponse;
        break;
      }

      console.warn(`[CONCEPTUAL-LESSON /turn] Validation failed, attempt ${attempt + 1}`, validation.errors);
      if (attempt === MAX_RETRIES) {
        const mcqErrorsOnly =
          candidate?.question_type === 'mcq' &&
          validation.errors.length > 0 &&
          validation.errors.every((e) => e.includes('mcq_options'));

        if (mcqErrorsOnly) {
          // Recovery mode: if the model failed only MCQ options shape/count checks,
          // return anyway so the app can fall back to free-text input.
          if (!Array.isArray(normalized.mcq_options)) {
            normalized.mcq_options = [];
          }
          parsed = normalized as ConceptualLessonResponse;
          console.warn('[CONCEPTUAL-LESSON /turn] Recovering with empty mcq_options');
          break;
        }

        throw new Error(
          `AI returned invalid response after retries: ${validation.errors.join('; ')}`,
        );
      }
    }

    if (!parsed) throw new Error('AI_PROCESSING_FAILED: no valid response after retries');

    console.info(`[CONCEPTUAL-LESSON /turn] Success`, {
      beatIn: lesson_state.beat,
      beatOut: parsed.beat_id,
      turnCount: parsed.lesson_state?.turn_count,
      responseType: parsed.response_type,
      model: modelUsed,
      isMQContinue,
      durationMs: Date.now() - startTime,
    });

    // --- Log ---
    logLessonCall({
      userId,
      gradeLevel: Math.max(1, effectiveState.student_age - 5),
      topic: effectiveState.topic,
      responseText: lastResponseText,
      responseTimeMs: Date.now() - startTime,
      success: true,
      usageMetadata: lastUsageMetadata,
      model: modelUsed,
    });
    void flushApiLogger();

    return res.status(200).json({ ...parsed, success: true });
  } catch (error: any) {
    console.error(`[CONCEPTUAL-LESSON /turn] Failed`, {
      error: error.message,
      beat: lesson_state.beat,
      turnCount: lesson_state.turn_count,
      durationMs: Date.now() - startTime,
    });

    logLessonCall({
      userId,
      gradeLevel: Math.max(1, (lesson_state as ConceptualLessonState).student_age - 5),
      topic: (lesson_state as ConceptualLessonState).topic,
      responseTimeMs: Date.now() - startTime,
      success: false,
      error: error.message || 'UnknownError',
      model: modelUsed,
    });
    void flushApiLogger();

    const errorResponse = createErrorResponse(error, ENDPOINT, {
      beat: lesson_state.beat,
    });
    return res.status(errorResponse.status).json(errorResponse.body);
  }
}
