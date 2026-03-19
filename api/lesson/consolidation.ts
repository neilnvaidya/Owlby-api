import { flushApiLogger, logLessonV3Call } from '../../lib/api-logger.js';
import { lessonV3ConsolidationResponseSchema } from '../../lib/ai-schemas.js';
import { getLessonV3ConsolidationInstructions } from '../../lib/ai-instructions.js';
import { runLessonV3WithSchemaRetries } from '../../lib/lesson-v3-ai.js';
import type { LessonConsolidationResponseBody, LessonObjectivesState } from '../../lib/lesson-v3-types.js';
import {
  parseLessonObjectivesState,
  validateLessonObjectivesForConsolidation,
  assertNonEmptyString,
} from '../../lib/lesson-v3-types.js';
import { getMcqOptionCountForConsolidation } from '../../lib/lesson-age.js';
import {
  jsonBadRequest,
  jsonGenerationError,
  lessonV3Prelude,
} from '../../lib/lesson-v3-route-common.js';

function parseConsolidation(text: string, lo: LessonObjectivesState): LessonConsolidationResponseBody {
  const raw = JSON.parse(text);
  if (raw.lesson_complete !== true) {
    throw new Error('lesson_complete must be true');
  }
  const explain_back_prompt = assertNonEmptyString(
    raw.explain_back_prompt,
    'explain_back_prompt',
  );
  const closing_message = assertNonEmptyString(raw.closing_message, 'closing_message');
  const sweep = raw.mcq_sweep;
  if (!Array.isArray(sweep)) {
    throw new Error('mcq_sweep must be an array');
  }
  if (sweep.length !== lo.objectives.length) {
    throw new Error('mcq_sweep must have one entry per objective');
  }
  const optN = getMcqOptionCountForConsolidation(lo.student_age);
  const items = sweep.map((item: any, i: number) => {
    const question = assertNonEmptyString(item.question, `mcq_sweep[${i}].question`);
    const options = item.options;
    if (!Array.isArray(options) || options.length !== optN) {
      throw new Error(`mcq_sweep[${i}].options must have ${optN} strings`);
    }
    const opts = options.map((x: unknown) => String(x));
    const correct_answer = assertNonEmptyString(item.correct_answer, `mcq_sweep[${i}].correct_answer`);
    if (!opts.includes(correct_answer)) {
      throw new Error(`mcq_sweep[${i}].correct_answer must be in options`);
    }
    const explanation = assertNonEmptyString(item.explanation, `mcq_sweep[${i}].explanation`);
    return { question, options: opts, correct_answer, explanation };
  });

  return {
    mcq_sweep: items,
    explain_back_prompt,
    closing_message,
    lesson_complete: true,
  };
}

export default async function handler(req: any, res: any) {
  const startTime = Date.now();
  const ctx = await lessonV3Prelude(req, res, {
    rateLimitKey: 'lesson_v3_consolidation',
    rateLimitMax: 12,
    rateWindowMs: 60_000,
  });
  if (!ctx) return;

  const body = req.body || {};
  let lo: LessonObjectivesState;
  try {
    lo = parseLessonObjectivesState(body.lesson_objectives);
    validateLessonObjectivesForConsolidation(lo);
  } catch (e: any) {
    return jsonBadRequest(res, e?.message || 'Invalid lesson_objectives for consolidation.');
  }

  let modelUsed = 'unknown';

  try {
    const loJson = JSON.stringify(lo);
    const instruction = getLessonV3ConsolidationInstructions(loJson);
    const contents = [
      {
        role: 'user',
        parts: [{ text: 'Return consolidation JSON: mcq_sweep, explain_back_prompt, closing_message, lesson_complete true.' }],
      },
    ];

    const { data, responseText, usageMetadata, modelUsed: m } =
      await runLessonV3WithSchemaRetries(
        'lesson_consolidation',
        lessonV3ConsolidationResponseSchema,
        instruction,
        contents,
        loJson.slice(0, 2000),
        (text) => parseConsolidation(text, lo),
      );
    modelUsed = m;

    logLessonV3Call({
      userId: ctx.userId,
      step: 'consolidation',
      studentAge: lo.student_age,
      inputSummary: lo.topic.slice(0, 120),
      responseText,
      responseTimeMs: Date.now() - startTime,
      success: true,
      usageMetadata,
      model: modelUsed,
    });
    void flushApiLogger();

    return res.status(200).json({
      success: true,
      mcq_sweep: data.mcq_sweep,
      explain_back_prompt: data.explain_back_prompt,
      closing_message: data.closing_message,
      lesson_complete: data.lesson_complete,
    });
  } catch (err: any) {
    logLessonV3Call({
      userId: ctx.userId,
      step: 'consolidation',
      studentAge: lo.student_age,
      inputSummary: lo.topic.slice(0, 120),
      responseTimeMs: Date.now() - startTime,
      success: false,
      error: err?.message || 'GenerationFailed',
      model: modelUsed,
    });
    void flushApiLogger();
    return jsonGenerationError(
      res,
      'We could not finish the lesson review. Please try again.',
    );
  }
}
