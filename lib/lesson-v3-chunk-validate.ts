import type { LessonChunkResponseBody } from './lesson-v3-types.js';
import { assertNonEmptyString } from './lesson-v3-types.js';
import {
  getExpectedChunkQuestionType,
  getMcqOptionCountForChunk,
} from './lesson-age.js';

export function parseChunkResponseJson(text: string): LessonChunkResponseBody {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON in chunk response');
  }
  const content = assertNonEmptyString(raw.content, 'content');
  if (!Array.isArray(raw.learning_points) || raw.learning_points.length < 1) {
    throw new Error('learning_points must be a non-empty array');
  }
  const learning_points = raw.learning_points.map((p: unknown, i: number) =>
    assertNonEmptyString(p, `learning_points[${i}]`),
  );
  if (!Array.isArray(raw.questions) || raw.questions.length < 1) {
    throw new Error('questions must be a non-empty array');
  }
  if (raw.questions.length !== learning_points.length) {
    throw new Error('questions length must match learning_points length');
  }
  const questions = raw.questions.map((qRaw: any, i: number) => {
    const question = assertNonEmptyString(qRaw?.question, `questions[${i}].question`);
    const qt = qRaw?.question_type;
    if (qt !== 'mcq' && qt !== 'short_answer' && qt !== 'higher_order') {
      throw new Error(`questions[${i}].question_type invalid`);
    }
    const mcq_options = Array.isArray(qRaw?.mcq_options)
      ? qRaw.mcq_options.map((x: unknown) => String(x))
      : [];
    const correct_answer =
      qRaw?.correct_answer === null || qRaw?.correct_answer === undefined
        ? null
        : String(qRaw.correct_answer);
    return { question, question_type: qt, mcq_options, correct_answer };
  });
  // Keep first-question fields for compatibility; fallback if model omitted them.
  const first = questions[0];
  const question =
    typeof raw.question === 'string' && raw.question.trim()
      ? raw.question.trim()
      : first.question;
  const qt = (raw.question_type ?? first.question_type) as LessonChunkResponseBody['question_type'];
  const mcq_options = Array.isArray(raw.mcq_options)
    ? raw.mcq_options.map((x: unknown) => String(x))
    : first.mcq_options;
  const correct_answer =
    raw.correct_answer === null || raw.correct_answer === undefined
      ? first.correct_answer
      : String(raw.correct_answer);
  return {
    content,
    learning_points,
    questions,
    question,
    question_type: qt,
    mcq_options,
    correct_answer,
  };
}

export function validateChunkForAge(body: LessonChunkResponseBody, age: number): void {
  const expected = getExpectedChunkQuestionType(age);
  if (!Array.isArray(body.learning_points) || body.learning_points.length < 2) {
    throw new Error('learning_points must contain at least 2 items');
  }
  if (!Array.isArray(body.questions) || body.questions.length !== body.learning_points.length) {
    throw new Error('questions must match learning_points length');
  }
  body.questions.forEach((q, i) => {
    if (q.question_type !== expected) {
      throw new Error(`questions[${i}].question_type must be ${expected} for age ${age}`);
    }
    if (expected === 'mcq') {
      const n = getMcqOptionCountForChunk(age);
      if (q.mcq_options.length !== n) {
        throw new Error(`questions[${i}].mcq_options must have exactly ${n} items`);
      }
      if (!q.correct_answer || !q.mcq_options.includes(q.correct_answer)) {
        throw new Error(`questions[${i}].correct_answer must be one of mcq_options`);
      }
    } else {
      if (q.mcq_options.length !== 0) {
        throw new Error(`questions[${i}].mcq_options must be empty for non-mcq`);
      }
      if (q.correct_answer !== null) {
        throw new Error(`questions[${i}].correct_answer must be null for non-mcq`);
      }
    }
  });
  // Compatibility fields must mirror the first question.
  if (body.question !== body.questions[0].question) {
    throw new Error('question must mirror questions[0].question');
  }
  if (body.question_type !== body.questions[0].question_type) {
    throw new Error('question_type must mirror questions[0].question_type');
  }
}
