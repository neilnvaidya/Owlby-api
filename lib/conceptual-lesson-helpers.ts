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
