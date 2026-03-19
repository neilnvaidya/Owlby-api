import { flushApiLogger, logLessonV3Call } from '../../lib/api-logger.js';
import { lessonV3ObjectivesResponseSchema } from '../../lib/ai-schemas.js';
import { getLessonV3ObjectivesInstructions } from '../../lib/ai-instructions.js';
import { runLessonV3WithSchemaRetries } from '../../lib/lesson-v3-ai.js';
import {
  parseLessonObjectivesState,
  validateLessonObjectivesAfterRoute2,
} from '../../lib/lesson-v3-types.js';
import { assertNonEmptyString } from '../../lib/lesson-v3-types.js';
import { getObjectiveCountForAge } from '../../lib/lesson-age.js';
import {
  jsonBadRequest,
  jsonGenerationError,
  lessonV3Prelude,
  validateStudentAgeField,
} from '../../lib/lesson-v3-route-common.js';

function parseObjectivesResponse(text: string, expectedAge: number, expectedCount: number) {
  const raw = JSON.parse(text);
  const bridge_message = assertNonEmptyString(raw.bridge_message, 'bridge_message');
  const lo = parseLessonObjectivesState(raw.lesson_objectives);
  validateLessonObjectivesAfterRoute2(lo, expectedCount, expectedAge);
  return { bridge_message, lesson_objectives: lo };
}

export default async function handler(req: any, res: any) {
  const startTime = Date.now();
  const ctx = await lessonV3Prelude(req, res, {
    rateLimitKey: 'lesson_v3_objectives',
    rateLimitMax: 12,
    rateWindowMs: 60_000,
  });
  if (!ctx) return;

  const body = req.body || {};
  const student_request =
    typeof body.student_request === 'string' ? body.student_request.trim() : '';
  const student_age = body.student_age;
  const starter_response =
    typeof body.starter_response === 'string' ? body.starter_response : '';

  if (!student_request) {
    return jsonBadRequest(res, 'Missing student_request.');
  }
  if (!validateStudentAgeField(student_age)) {
    return jsonBadRequest(res, 'Please provide a valid student age (5–18).');
  }

  const expectedCount = getObjectiveCountForAge(student_age);
  let modelUsed = 'unknown';

  try {
    const instruction = getLessonV3ObjectivesInstructions(
      student_request,
      student_age,
      starter_response,
    );
    const contents = [
      {
        role: 'user',
        parts: [{ text: 'Generate bridge_message and lesson_objectives JSON.' }],
      },
    ];

    const { data, responseText, usageMetadata, modelUsed: m } =
      await runLessonV3WithSchemaRetries(
        'lesson_objectives',
        lessonV3ObjectivesResponseSchema,
        instruction,
        contents,
        `${student_request}|${starter_response}`.slice(0, 2000),
        (text) => parseObjectivesResponse(text, student_age, expectedCount),
      );
    modelUsed = m;

    logLessonV3Call({
      userId: ctx.userId,
      step: 'objectives',
      studentAge: student_age,
      inputSummary: student_request.slice(0, 120),
      responseText,
      responseTimeMs: Date.now() - startTime,
      success: true,
      usageMetadata,
      model: modelUsed,
    });
    void flushApiLogger();

    return res.status(200).json({
      success: true,
      bridge_message: data.bridge_message,
      lesson_objectives: data.lesson_objectives,
    });
  } catch (err: any) {
    logLessonV3Call({
      userId: ctx.userId,
      step: 'objectives',
      studentAge: student_age,
      inputSummary: student_request.slice(0, 120),
      responseTimeMs: Date.now() - startTime,
      success: false,
      error: err?.message || 'GenerationFailed',
      model: modelUsed,
    });
    void flushApiLogger();
    return jsonGenerationError(
      res,
      'We could not prepare your lesson objectives. Please start again from the beginning.',
    );
  }
}
