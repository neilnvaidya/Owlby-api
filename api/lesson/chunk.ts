import { flushApiLogger, logLessonV3Call } from '../../lib/api-logger.js';
import { lessonV3ChunkResponseSchema } from '../../lib/ai-schemas.js';
import {
  getLessonV3ChunkInstructions,
  getLessonV3ChunkMcqFallbackInstructions,
} from '../../lib/ai-instructions.js';
import { processAIRequest } from '../../lib/api-handler.js';
import { runLessonV3WithSchemaRetries } from '../../lib/lesson-v3-ai.js';
import type { LessonChunkResponseBody, LessonObjectivesState } from '../../lib/lesson-v3-types.js';
import {
  parseLessonObjectivesState,
  validateLessonObjectivesForChunk,
} from '../../lib/lesson-v3-types.js';
import {
  parseChunkResponseJson,
  validateChunkForAge,
} from '../../lib/lesson-v3-chunk-validate.js';
import {
  getExpectedChunkQuestionType,
  getMcqOptionCountForChunk,
} from '../../lib/lesson-age.js';
import {
  jsonBadRequest,
  jsonGenerationError,
  lessonV3Prelude,
} from '../../lib/lesson-v3-route-common.js';
import { resolveWikimediaImage } from '../../lib/wikimedia-image.js';

async function generateChunk(lo: LessonObjectivesState): Promise<{
  data: LessonChunkResponseBody;
  responseText: string;
  usageMetadata: any;
  modelUsed: string;
  fallbackUsed: boolean;
}> {
  const loJson = JSON.stringify(lo);
  const baseInstr = getLessonV3ChunkInstructions(loJson, lo.student_age);
  const contents = [
    {
      role: 'user',
      parts: [{ text: 'Return chunk JSON for current objective with learning_points and one question per point.' }],
    },
  ];
  const inputKey = loJson.slice(0, 1500);
  const age = lo.student_age;
  const expected = getExpectedChunkQuestionType(age);
  const n = getMcqOptionCountForChunk(age);

  const parseValid = (text: string) => {
    const b = parseChunkResponseJson(text);
    validateChunkForAge(b, age);
    return b;
  };

  const run = (instruction: string) =>
    runLessonV3WithSchemaRetries(
      'lesson_chunk',
      lessonV3ChunkResponseSchema,
      instruction,
      contents,
      inputKey,
      parseValid,
    );

  try {
    return await run(baseInstr);
  } catch {
    // Part 9.3: one retry with explicit correction
  }

  const strict =
    baseInstr +
    `\n\nCRITICAL CORRECTION: student_age=${age}. question_type MUST be exactly "${expected}".` +
    (expected === 'mcq'
      ? ` mcq_options MUST be an array of exactly ${n} strings. correct_answer MUST be identical to one of those strings.`
      : ' mcq_options MUST be []. correct_answer MUST be null.');

  try {
    return await run(strict);
  } catch {
    // Server-side correction per spec
  }

  let partial: LessonChunkResponseBody;
  let lastMeta: any;
  let lastModel = 'unknown';
  let lastFb = false;
  let lastText = '';
  try {
    const r = await processAIRequest(
      lessonV3ChunkResponseSchema,
      baseInstr,
      contents,
      'lesson_chunk',
      inputKey,
    );
    partial = parseChunkResponseJson(r.responseText);
    lastMeta = r.usageMetadata;
    lastModel = r.modelUsed;
    lastFb = r.fallbackUsed;
    lastText = r.responseText;
  } catch {
    throw new Error('LESSON_CHUNK_FAILED');
  }

  if (expected !== 'mcq') {
    const normalizedQuestions = partial.questions.map((q) => ({
      ...q,
      question_type: expected,
      mcq_options: [],
      correct_answer: null,
    }));
    return {
      data: {
        ...partial,
        questions: normalizedQuestions,
        question: normalizedQuestions[0].question,
        question_type: normalizedQuestions[0].question_type,
        mcq_options: normalizedQuestions[0].mcq_options,
        correct_answer: normalizedQuestions[0].correct_answer,
      },
      responseText: lastText,
      usageMetadata: lastMeta,
      modelUsed: lastModel,
      fallbackUsed: lastFb,
    };
  }

  const fbInstr = getLessonV3ChunkMcqFallbackInstructions(
    partial.content,
    partial.learning_points,
    partial.questions.map((q) => q.question),
    age,
    n,
  );
  const fb = await runLessonV3WithSchemaRetries(
    'lesson_chunk',
    lessonV3ChunkResponseSchema,
    fbInstr,
    contents,
    `${inputKey}|mcq-fallback`,
    parseValid,
  );
  return fb;
}

export default async function handler(req: any, res: any) {
  const startTime = Date.now();
  const ctx = await lessonV3Prelude(req, res, {
    rateLimitKey: 'lesson_v3_chunk',
    rateLimitMax: 30,
    rateWindowMs: 60_000,
  });
  if (!ctx) return;

  const body = req.body || {};
  let lo: LessonObjectivesState;
  try {
    lo = parseLessonObjectivesState(body.lesson_objectives);
    validateLessonObjectivesForChunk(lo);
  } catch (e: any) {
    return jsonBadRequest(res, e?.message || 'Invalid lesson_objectives.');
  }

  let modelUsed = 'unknown';

  try {
    const { data, responseText, usageMetadata, modelUsed: m } =
      await generateChunk(lo);
    modelUsed = m;
    const currentObjective = lo.objectives[lo.current_index];
    // Prefer the objective's image_query (a clean 2–4 word visual phrase from Route 2) —
    // it searches Commons far more reliably than a long "topic + objective title" string.
    // Fall back to topic+title, then title, for older clients that lack image_query.
    const objectiveTitle = currentObjective?.title?.trim();
    const imageQuery = currentObjective?.image_query?.trim();
    const specificQuery = objectiveTitle ? `${lo.topic} ${objectiveTitle}` : lo.topic;
    const avoidImageUrls = Array.isArray(body.avoid_image_urls)
      ? body.avoid_image_urls.filter((u: unknown): u is string => typeof u === 'string' && u.length > 0)
      : undefined;
    const image = await resolveWikimediaImage({
      wikimediaQuery: imageQuery || undefined,
      topic: specificQuery,
      fallbackQuery: objectiveTitle || lo.topic,
      maxQueries: 3,
      avoidUrls: avoidImageUrls,
    });

    logLessonV3Call({
      userId: ctx.userId,
      step: 'chunk',
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
      content: data.content,
      learning_points: data.learning_points,
      questions: data.questions,
      question: data.question,
      question_type: data.question_type,
      mcq_options: data.mcq_options,
      correct_answer: data.correct_answer,
      image,
    });
  } catch (err: any) {
    logLessonV3Call({
      userId: ctx.userId,
      step: 'chunk',
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
      'We could not load this part of the lesson. Please try again.',
    );
  }
}
