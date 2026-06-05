import { flushApiLogger, logLessonV3Call } from '../../lib/api-logger.js';
import { lessonV3EvaluateResponseSchema } from '../../lib/ai-schemas.js';
import { getLessonV3EvaluateInstructions } from '../../lib/ai-instructions.js';
import { runLessonV3WithSchemaRetries } from '../../lib/lesson-v3-ai.js';
import {
  parseLessonObjectivesState,
  assertNonEmptyString,
} from '../../lib/lesson-v3-types.js';
import {
  jsonBadRequest,
  jsonGenerationError,
  lessonV3Prelude,
} from '../../lib/lesson-v3-route-common.js';

function parseEvaluate(text: string) {
  const raw = JSON.parse(text);
  const result = raw.result;
  if (result !== 'correct' && result !== 'partial' && result !== 'incorrect') {
    throw new Error('Invalid result');
  }
  const feedback = assertNonEmptyString(raw.feedback, 'feedback');
  const note = assertNonEmptyString(raw.note, 'note');
  return { result, feedback, note };
}

export default async function handler(req: any, res: any) {
  const startTime = Date.now();
  const ctx = await lessonV3Prelude(req, res, {
    rateLimitKey: 'lesson_v3_evaluate',
    rateLimitMax: 30,
    rateWindowMs: 60_000,
  });
  if (!ctx) return;

  const body = req.body || {};
  let lo: ReturnType<typeof parseLessonObjectivesState>;
  try {
    lo = parseLessonObjectivesState(body.lesson_objectives);
  } catch (e: any) {
    return jsonBadRequest(res, e?.message || 'Invalid lesson_objectives.');
  }

  const question = typeof body.question === 'string' ? body.question : '';
  const question_type = body.question_type;
  const student_answer = typeof body.student_answer === 'string' ? body.student_answer : '';

  if (!question.trim()) {
    return jsonBadRequest(res, 'Missing question.');
  }
  if (question_type === 'mcq') {
    return jsonBadRequest(res, 'Route 4 does not accept MCQ. Evaluate MCQ client-side.');
  }
  if (question_type !== 'short_answer' && question_type !== 'higher_order') {
    return jsonBadRequest(res, 'question_type must be short_answer or higher_order.');
  }

  let modelUsed = 'unknown';

  try {
    const loJson = JSON.stringify(lo);
    const instruction = getLessonV3EvaluateInstructions(
      loJson,
      question,
      question_type,
      student_answer,
    );
    const contents = [
      {
        role: 'user',
        parts: [{ text: 'Evaluate the student answer and return JSON.' }],
      },
    ];

    const { data, responseText, usageMetadata, modelUsed: m } =
      await runLessonV3WithSchemaRetries(
        'lesson_evaluate',
        lessonV3EvaluateResponseSchema,
        instruction,
        contents,
        `${question}|${student_answer}`.slice(0, 2000),
        parseEvaluate,
      );
    modelUsed = m;

    logLessonV3Call({
      userId: ctx.userId,
      step: 'evaluate',
      studentAge: lo.student_age,
      inputSummary: question.slice(0, 100),
      responseText,
      responseTimeMs: Date.now() - startTime,
      success: true,
      usageMetadata,
      model: modelUsed,
    });
    void flushApiLogger();

    return res.status(200).json({
      success: true,
      result: data.result,
      feedback: data.feedback,
      note: data.note,
    });
  } catch (err: any) {
    logLessonV3Call({
      userId: ctx.userId,
      step: 'evaluate',
      studentAge: lo.student_age,
      inputSummary: question.slice(0, 100),
      responseTimeMs: Date.now() - startTime,
      success: false,
      error: err?.message || 'GenerationFailed',
      model: modelUsed,
    });
    void flushApiLogger();
    return jsonGenerationError(
      res,
      'We could not evaluate that answer. Please try again.',
    );
  }
}
