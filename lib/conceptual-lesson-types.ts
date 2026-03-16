/**
 * Conceptual Lesson V2 — Types, enums, and constants.
 * Pattern: CONCEPTUAL only. Other patterns (PROCEDURAL, ANALYTICAL, etc.) will
 * have their own type files when implemented.
 *
 * Reference: /Docs/lesson_system_spec_v2.md
 */

// ---------------------------------------------------------------------------
// String enums
// ---------------------------------------------------------------------------

export type Phase = 'starter' | 'main' | 'consolidation';

export type BeatId =
  | 'S1' | 'S2' | 'S3'
  | 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'MQ' | 'M6'
  | 'C1' | 'C2' | 'C3';

export type QuestionType = 'mcq' | 'free_text' | 'voice';

export type ResponseType =
  | 'lesson_start'
  | 'lesson_turn'
  | 'mq_answer'
  | 'lesson_complete';

export type ChunkType = 'what_is_it' | 'how_it_works' | 'examples' | 'nuance';

export type DepthLevel = 'scratch' | 'some_basics' | 'solid';

// ---------------------------------------------------------------------------
// Age band helpers
// ---------------------------------------------------------------------------

export type AgeBand = '5-7' | '8-11' | '12-15' | '16-18';

export function getAgeBand(age: number): AgeBand {
  if (age <= 7) return '5-7';
  if (age <= 11) return '8-11';
  if (age <= 15) return '12-15';
  return '16-18';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TURN_BUDGETS: Record<AgeBand, number> = {
  '5-7': 8,
  '8-11': 12,
  '12-15': 16,
  '16-18': 20,
};

export const CHUNK_SETS_BY_AGE: Record<AgeBand, ChunkType[]> = {
  '5-7': ['what_is_it', 'examples'],
  '8-11': ['what_is_it', 'how_it_works', 'examples'],
  '12-15': ['what_is_it', 'how_it_works', 'examples'],
  '16-18': ['what_is_it', 'how_it_works', 'nuance'],
};

export const SENTENCE_LIMITS: Record<AgeBand, { min: number; max: number }> = {
  '5-7': { min: 1, max: 2 },
  '8-11': { min: 2, max: 3 },
  '12-15': { min: 3, max: 4 },
  '16-18': { min: 4, max: 5 },
};

export const MCQ_OPTION_COUNTS: Record<AgeBand, { min: number; max: number }> = {
  '5-7': { min: 2, max: 2 },
  '8-11': { min: 3, max: 3 },
  '12-15': { min: 3, max: 4 },
  '16-18': { min: 3, max: 4 },
};

export const MQ_CONTINUE_SENTINEL = '__mq_continue__';

export const VALID_BEAT_IDS: readonly BeatId[] = [
  'S1', 'S2', 'S3', 'M1', 'M2', 'M3', 'M4', 'M5', 'MQ', 'M6', 'C1', 'C2', 'C3',
];

export const CHUNK_LABELS: Record<ChunkType, string> = {
  what_is_it: 'What is it?',
  how_it_works: 'How it works',
  examples: 'Real-world examples',
  nuance: 'Deeper details',
};

// ---------------------------------------------------------------------------
// Data structures
// ---------------------------------------------------------------------------

export interface ConceptualLessonOverview {
  topic: string;
  chunks: string[];
  pattern: 'CONCEPTUAL';
  turn_budget: number;
}

export interface ConceptualLessonState {
  phase: Phase;
  beat: BeatId;
  chunk_index: number;
  chunk_total: number;
  chunks_planned: ChunkType[];
  chunks_completed: ChunkType[];
  turn_count: number;
  turn_budget: number;
  stuck_ladder_pos: number;
  misconception: string | null;
  depth_level: DepthLevel | null;
  analogy_anchor: string | null;
  mq_questions_asked: number;
  pattern: 'CONCEPTUAL';
  topic: string;
  student_age: number;
  overview: ConceptualLessonOverview;
}

export interface ConversationEntry {
  role: 'user' | 'assistant';
  content: string;
}

export interface ConceptualLessonResponse {
  response_type: ResponseType;
  preamble: string;
  question: string | null;
  question_type: QuestionType | null;
  mcq_options: string[] | null;
  beat_id: BeatId;
  mq_answer: string | null;
  mq_questions_remaining: number | null;
  lesson_state: ConceptualLessonState;
  tags: string[];
  image_query: string;
  overview: ConceptualLessonOverview | null;
}

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

export interface ConceptualLessonStartRequest {
  student_request: string;
  student_age: number;
}

export interface ConceptualLessonTurnRequest {
  student_response: string;
  lesson_state: ConceptualLessonState;
  conversation_history: ConversationEntry[];
}
