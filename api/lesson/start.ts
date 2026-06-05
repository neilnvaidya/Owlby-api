import { flushApiLogger, logLessonV3Call } from '../../lib/api-logger.js';
import { lessonV3StartResponseSchema } from '../../lib/ai-schemas.js';
import { getLessonV3StartInstructions } from '../../lib/ai-instructions.js';
import { incrementDailyUsage } from '../../lib/usage-daily.js';
import { runLessonV3WithSchemaRetries } from '../../lib/lesson-v3-ai.js';
import { assertNonEmptyString } from '../../lib/lesson-v3-types.js';
import {
  jsonBadRequest,
  jsonGenerationError,
  lessonV3Prelude,
  validateStudentAgeField,
} from '../../lib/lesson-v3-route-common.js';

function parseStartResponse(text: string) {
  const raw = JSON.parse(text);
  return {
    hook: assertNonEmptyString(raw.hook, 'hook'),
    question: assertNonEmptyString(raw.question, 'question'),
  };
}

export default async function handler(req: any, res: any) {
  const startTime = Date.now();
  const ctx = await lessonV3Prelude(req, res, {
    rateLimitKey: 'lesson_v3_start',
    rateLimitMax: 12,
    rateWindowMs: 60_000,
  });
  if (!ctx) return;

  const body = req.body || {};
  const student_request =
    typeof body.student_request === 'string' ? body.student_request.trim() : '';
  const student_age = body.student_age;

  if (!student_request) {
    return jsonBadRequest(res, 'Please enter what you want to learn.');
  }
  if (!validateStudentAgeField(student_age)) {
    return jsonBadRequest(res, 'Please provide a valid student age (5–18).');
  }

  let modelUsed = 'unknown';
  let fallbackUsed = false;

  try {
    const instruction = getLessonV3StartInstructions(student_request, student_age);
    const contents = [
      {
        role: 'user',
        parts: [{ text: `Generate hook and prior-knowledge question for the topic request.` }],
      },
    ];

    const { data, responseText, usageMetadata, modelUsed: m, fallbackUsed: f } =
      await runLessonV3WithSchemaRetries(
        'lesson_start',
        lessonV3StartResponseSchema,
        instruction,
        contents,
        student_request.slice(0, 2000),
        parseStartResponse,
      );
    modelUsed = m;
    fallbackUsed = f;

    logLessonV3Call({
      userId: ctx.userId,
      step: 'start',
      studentAge: student_age,
      inputSummary: student_request.slice(0, 200),
      responseText,
      responseTimeMs: Date.now() - startTime,
      success: true,
      usageMetadata,
      model: modelUsed,
    });
    void flushApiLogger();

    /** Lesson v3: one daily "lesson" count per session start (Part 9.4 — Route 2 not retried alone). */
    await incrementDailyUsage(ctx.userId, 'lesson');

    return res.status(200).json({
      success: true,
      hook: data.hook,
      question: data.question,
    });
  } catch (err: any) {
    logLessonV3Call({
      userId: ctx.userId,
      step: 'start',
      studentAge: student_age,
      inputSummary: student_request.slice(0, 200),
      responseTimeMs: Date.now() - startTime,
      success: false,
      error: err?.message || 'GenerationFailed',
      model: modelUsed,
    });
    void flushApiLogger();
    return jsonGenerationError(
      res,
      'We could not start the lesson right now. Please try again.',
    );
  }
}
