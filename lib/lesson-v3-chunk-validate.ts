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
  const question = assertNonEmptyString(raw.question, 'question');
  const qt = raw.question_type;
  if (qt !== 'mcq' && qt !== 'short_answer' && qt !== 'higher_order') {
    throw new Error('Invalid question_type');
  }
  const mcq_options = Array.isArray(raw.mcq_options)
    ? raw.mcq_options.map((x: unknown) => String(x))
    : [];
  const correct_answer =
    raw.correct_answer === null || raw.correct_answer === undefined
      ? null
      : String(raw.correct_answer);
  return {
    content,
    question,
    question_type: qt,
    mcq_options,
    correct_answer,
  };
}

export function validateChunkForAge(body: LessonChunkResponseBody, age: number): void {
  const expected = getExpectedChunkQuestionType(age);
  if (body.question_type !== expected) {
    throw new Error(`question_type must be ${expected} for age ${age}`);
  }
  if (expected === 'mcq') {
    const n = getMcqOptionCountForChunk(age);
    if (body.mcq_options.length !== n) {
      throw new Error(`mcq_options must have exactly ${n} items`);
    }
    if (
      !body.correct_answer ||
      !body.mcq_options.includes(body.correct_answer)
    ) {
      throw new Error('correct_answer must be one of mcq_options');
    }
  } else {
    if (body.mcq_options.length !== 0) {
      throw new Error('mcq_options must be empty for non-mcq');
    }
    if (body.correct_answer !== null) {
      throw new Error('correct_answer must be null for non-mcq');
    }
  }
}
