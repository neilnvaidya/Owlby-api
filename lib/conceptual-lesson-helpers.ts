/**
 * Conceptual Lesson V2 — Helper functions.
 * Age band logic, state builders, conversation formatting, validation.
 */

import {
  type AgeBand,
  type ChunkType,
  type ConceptualLessonState,
  type ConceptualLessonOverview,
  type ConceptualLessonResponse,
  type ConversationEntry,
  getAgeBand,
  TURN_BUDGETS,
  CHUNK_SETS_BY_AGE,
  CHUNK_LABELS,
} from './conceptual-lesson-types.js';

// ---------------------------------------------------------------------------
// Age band and planning
// ---------------------------------------------------------------------------

export function getTurnBudget(age: number): number {
  return TURN_BUDGETS[getAgeBand(age)];
}

export function getChunksPlanned(age: number): ChunkType[] {
  return [...CHUNK_SETS_BY_AGE[getAgeBand(age)]];
}

export function getChunkLabels(chunks: ChunkType[]): string[] {
  return chunks.map((c) => CHUNK_LABELS[c]);
}

// ---------------------------------------------------------------------------
// Initial state builder (used by /start)
// ---------------------------------------------------------------------------

export function buildInitialLessonState(
  topic: string,
  age: number,
  chunksPlanned: ChunkType[],
  turnBudget: number,
  overview: ConceptualLessonOverview,
): ConceptualLessonState {
  return {
    phase: 'starter',
    beat: 'S2',
    chunk_index: 0,
    chunk_total: chunksPlanned.length,
    chunks_planned: chunksPlanned,
    chunks_completed: [],
    turn_count: 1,
    turn_budget: turnBudget,
    stuck_ladder_pos: 0,
    misconception: null,
    depth_level: null,
    analogy_anchor: null,
    mq_questions_asked: 0,
    pattern: 'CONCEPTUAL',
    topic,
    student_age: age,
    overview,
  };
}

// ---------------------------------------------------------------------------
// Conversation formatting for Gemini multi-turn
// ---------------------------------------------------------------------------

/**
 * Convert our ConversationEntry[] into the Gemini `contents` format.
 * Gemini expects: [{role:'user', parts:[{text}]}, {role:'model', parts:[{text}]}, ...]
 * Our entries use 'assistant' which maps to 'model'.
 */
export function formatConversationForGemini(
  history: ConversationEntry[],
  latestUserMessage?: string,
): Array<{ role: string; parts: Array<{ text: string }> }> {
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  for (const entry of history) {
    contents.push({
      role: entry.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: entry.content }],
    });
  }

  if (latestUserMessage) {
    contents.push({
      role: 'user',
      parts: [{ text: latestUserMessage }],
    });
  }

  return contents;
}

// ---------------------------------------------------------------------------
// Budget checks
// ---------------------------------------------------------------------------

export function isBudgetExhausted(state: ConceptualLessonState): boolean {
  return state.turn_count / state.turn_budget >= 0.8;
}

export function shouldSkipM5(age: number): boolean {
  return age < 8;
}

// ---------------------------------------------------------------------------
// Response validation (spec section 11)
// ---------------------------------------------------------------------------

const VALID_BEAT_IDS_SET = new Set([
  'S1', 'S2', 'S3', 'M1', 'M2', 'M3', 'M4', 'M5', 'MQ', 'M6', 'C1', 'C2', 'C3',
]);

const VALID_RESPONSE_TYPES = new Set([
  'lesson_start', 'lesson_turn', 'mq_answer', 'lesson_complete',
]);

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateAIResponse(
  response: any,
  previousState?: ConceptualLessonState,
): ValidationResult {
  const errors: string[] = [];

  if (!response) {
    return { valid: false, errors: ['Response is null or undefined'] };
  }

  // Required fields
  if (!response.response_type || !VALID_RESPONSE_TYPES.has(response.response_type)) {
    errors.push(`Invalid response_type: ${response.response_type}`);
  }
  if (typeof response.preamble !== 'string') {
    errors.push('preamble must be a string');
  }
  if (!response.beat_id || !VALID_BEAT_IDS_SET.has(response.beat_id)) {
    errors.push(`Invalid beat_id: ${response.beat_id}`);
  }
  if (!response.lesson_state) {
    errors.push('lesson_state is missing');
  }
  if (!Array.isArray(response.tags) || response.tags.length < 3) {
    errors.push(`tags must have at least 3 items, got ${response.tags?.length ?? 0}`);
  }
  if (typeof response.image_query !== 'string') {
    errors.push('image_query must be a string');
  }

  // Lesson state validation
  const ls = response.lesson_state;
  if (ls) {
    if (ls.stuck_ladder_pos < 0 || ls.stuck_ladder_pos > 4) {
      errors.push(`stuck_ladder_pos out of range: ${ls.stuck_ladder_pos}`);
    }
    if (ls.mq_questions_asked < 0 || ls.mq_questions_asked > 2) {
      errors.push(`mq_questions_asked out of range: ${ls.mq_questions_asked}`);
    }
    if (ls.chunk_index > ls.chunk_total) {
      errors.push(`chunk_index (${ls.chunk_index}) > chunk_total (${ls.chunk_total})`);
    }

    if (previousState) {
      if (ls.turn_count !== previousState.turn_count + 1) {
        errors.push(
          `turn_count should be ${previousState.turn_count + 1}, got ${ls.turn_count}`,
        );
      }
    }
  }

  // MCQ validation
  if (response.question_type === 'mcq') {
    if (!Array.isArray(response.mcq_options) || response.mcq_options.length < 2 || response.mcq_options.length > 4) {
      errors.push(`mcq_options must have 2-4 items when question_type is mcq`);
    }
  }

  // MQ consistency
  if (response.beat_id === 'MQ' || response.response_type === 'mq_answer') {
    if (typeof response.mq_questions_remaining !== 'number') {
      errors.push('mq_questions_remaining required for MQ beats');
    }
  }

  // lesson_complete only on C3
  if (response.response_type === 'lesson_complete' && response.beat_id !== 'C3') {
    errors.push(`lesson_complete only valid with beat_id C3, got ${response.beat_id}`);
  }

  return { valid: errors.length === 0, errors };
}
