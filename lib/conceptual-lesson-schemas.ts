/**
 * Conceptual Lesson V2 — Gemini response schemas.
 * Structured output schemas for /start and /turn routes.
 */

import { Type } from '@google/genai';

const lessonStateSchema = {
  type: Type.OBJECT,
  required: [
    'phase', 'beat', 'chunk_index', 'chunk_total', 'chunks_planned',
    'chunks_completed', 'turn_count', 'turn_budget', 'stuck_ladder_pos',
    'mq_questions_asked', 'pattern', 'topic', 'student_age', 'overview',
  ],
  properties: {
    phase: { type: Type.STRING },
    beat: { type: Type.STRING },
    chunk_index: { type: Type.INTEGER },
    chunk_total: { type: Type.INTEGER },
    chunks_planned: { type: Type.ARRAY, items: { type: Type.STRING } },
    chunks_completed: { type: Type.ARRAY, items: { type: Type.STRING } },
    turn_count: { type: Type.INTEGER },
    turn_budget: { type: Type.INTEGER },
    stuck_ladder_pos: { type: Type.INTEGER },
    misconception: { type: Type.STRING, nullable: true },
    depth_level: { type: Type.STRING, nullable: true },
    analogy_anchor: { type: Type.STRING, nullable: true },
    mq_questions_asked: { type: Type.INTEGER },
    pattern: { type: Type.STRING },
    topic: { type: Type.STRING },
    student_age: { type: Type.INTEGER },
    overview: {
      type: Type.OBJECT,
      required: ['topic', 'chunks', 'pattern', 'turn_budget'],
      properties: {
        topic: { type: Type.STRING },
        chunks: { type: Type.ARRAY, items: { type: Type.STRING } },
        pattern: { type: Type.STRING },
        turn_budget: { type: Type.INTEGER },
      },
    },
  },
} as const;

/**
 * Schema for both /start and /turn responses.
 * All fields are present; nullable fields use nullable: true.
 */
export const conceptualLessonResponseSchema = {
  type: Type.OBJECT,
  required: [
    'response_type', 'preamble', 'beat_id', 'lesson_state', 'tags', 'image_query',
  ],
  properties: {
    response_type: { type: Type.STRING },
    preamble: { type: Type.STRING },
    question: { type: Type.STRING, nullable: true },
    question_type: { type: Type.STRING, nullable: true },
    mcq_options: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      nullable: true,
    },
    beat_id: { type: Type.STRING },
    mq_answer: { type: Type.STRING, nullable: true },
    mq_questions_remaining: { type: Type.INTEGER, nullable: true },
    lesson_state: lessonStateSchema,
    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
    image_query: { type: Type.STRING },
    overview: {
      type: Type.OBJECT,
      nullable: true,
      required: ['topic', 'chunks', 'pattern', 'turn_budget'],
      properties: {
        topic: { type: Type.STRING },
        chunks: { type: Type.ARRAY, items: { type: Type.STRING } },
        pattern: { type: Type.STRING },
        turn_budget: { type: Type.INTEGER },
      },
    },
  },
} as const;
