/**
 * Lesson System v3 — shared types and structural validators (Part 8).
 */

export type ObjectiveStatus = 'pending' | 'current' | 'complete';

export type ChunkQuestionType = 'mcq' | 'short_answer' | 'higher_order';

export interface LessonObjectiveEntry {
  title: string;
  status: ObjectiveStatus;
  note: string | null;
}

export interface LessonObjectivesState {
  student_age: number;
  topic: string;
  objectives: LessonObjectiveEntry[];
  current_index: number;
}

/** Route 1 */
export interface LessonStartRequestBody {
  student_request: string;
  student_age: number;
}

export interface LessonStartResponseBody {
  hook: string;
  question: string;
}

/** Route 2 */
export interface LessonObjectivesRequestBody {
  student_request: string;
  student_age: number;
  starter_response: string;
}

export interface LessonObjectivesResponseBody {
  bridge_message: string;
  lesson_objectives: LessonObjectivesState;
}

/** Route 3 */
export interface LessonChunkRequestBody {
  lesson_objectives: LessonObjectivesState;
}

export interface LessonChunkResponseBody {
  content: string;
  question: string;
  question_type: ChunkQuestionType;
  mcq_options: string[];
  correct_answer: string | null;
}

/** Route 4 */
export interface LessonEvaluateRequestBody {
  lesson_objectives: LessonObjectivesState;
  question: string;
  question_type: 'short_answer' | 'higher_order';
  student_answer: string;
}

export interface LessonEvaluateResponseBody {
  result: 'correct' | 'partial' | 'incorrect';
  feedback: string;
  note: string;
}

/** Route 5 */
export interface LessonConsolidationMcqItem {
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
}

export interface LessonConsolidationRequestBody {
  lesson_objectives: LessonObjectivesState;
}

export interface LessonConsolidationResponseBody {
  mcq_sweep: LessonConsolidationMcqItem[];
  explain_back_prompt: string;
  closing_message: string;
  lesson_complete: true;
}

// --- Invariant validators (throw or return error string) ---

export function assertNonEmptyString(v: unknown, field: string): string {
  if (typeof v !== 'string' || !v.trim()) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return v.trim();
}

export function parseLessonObjectivesState(raw: unknown): LessonObjectivesState {
  if (!raw || typeof raw !== 'object') {
    throw new Error('lesson_objectives must be an object');
  }
  const o = raw as Record<string, unknown>;
  const student_age = o.student_age;
  if (typeof student_age !== 'number' || !Number.isInteger(student_age)) {
    throw new Error('lesson_objectives.student_age must be an integer');
  }
  const topic = assertNonEmptyString(o.topic, 'lesson_objectives.topic');
  const current_index = o.current_index;
  if (typeof current_index !== 'number' || !Number.isInteger(current_index) || current_index < 0) {
    throw new Error('lesson_objectives.current_index must be a non-negative integer');
  }
  const objectives = o.objectives;
  if (!Array.isArray(objectives) || objectives.length < 1 || objectives.length > 4) {
    throw new Error('lesson_objectives.objectives must have 1–4 entries');
  }
  const entries: LessonObjectiveEntry[] = objectives.map((item, i) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`objectives[${i}] invalid`);
    }
    const e = item as Record<string, unknown>;
    const title = assertNonEmptyString(e.title, `objectives[${i}].title`);
    const status = e.status;
    if (status !== 'pending' && status !== 'current' && status !== 'complete') {
      throw new Error(`objectives[${i}].status invalid`);
    }
    const note = e.note === null || e.note === undefined
      ? null
      : typeof e.note === 'string'
        ? e.note
        : (() => {
            throw new Error(`objectives[${i}].note must be string or null`);
          })();
    return { title, status, note };
  });
  return { student_age, topic, objectives: entries, current_index };
}

/** After Route 2: first current, rest pending, all notes null, index 0 */
export function validateLessonObjectivesAfterRoute2(
  lo: LessonObjectivesState,
  expectedCount: number,
  expectedAge: number,
): void {
  if (lo.student_age !== expectedAge) {
    throw new Error('lesson_objectives.student_age must match request');
  }
  if (lo.objectives.length !== expectedCount) {
    throw new Error(`lesson_objectives must have exactly ${expectedCount} objectives for this age`);
  }
  if (lo.current_index !== 0) {
    throw new Error('lesson_objectives.current_index must be 0 from Route 2');
  }
  lo.objectives.forEach((obj, i) => {
    if (obj.note !== null) {
      throw new Error('All notes must be null after Route 2');
    }
    if (i === 0) {
      if (obj.status !== 'current') {
        throw new Error('First objective must be current');
      }
    } else if (obj.status !== 'pending') {
      throw new Error('Non-first objectives must be pending');
    }
  });
}

/** Route 3: exactly one current objective; current_index points to it */
export function validateLessonObjectivesForChunk(lo: LessonObjectivesState): void {
  const currentIdxs = lo.objectives
    .map((obj, i) => (obj.status === 'current' ? i : -1))
    .filter((i) => i >= 0);
  if (currentIdxs.length !== 1) {
    throw new Error('Route 3 requires exactly one objective with status "current"');
  }
  if (currentIdxs[0] !== lo.current_index) {
    throw new Error('current_index must match the objective with status "current"');
  }
  const cur = lo.objectives[lo.current_index];
  if (cur.status !== 'current' || cur.note !== null) {
    throw new Error('Current objective must have status current and note null');
  }
}

/** Route 5: all complete, non-null notes, index === length */
export function validateLessonObjectivesForConsolidation(lo: LessonObjectivesState): void {
  if (lo.objectives.length < 2) {
    throw new Error('Consolidation requires at least 2 objectives');
  }
  if (lo.current_index !== lo.objectives.length) {
    throw new Error('All objectives must be complete before consolidation (current_index === objectives.length)');
  }
  lo.objectives.forEach((obj, i) => {
    if (obj.status !== 'complete') {
      throw new Error(`objectives[${i}] must be complete for consolidation`);
    }
    if (obj.note === null || typeof obj.note !== 'string' || !obj.note.trim()) {
      throw new Error(`objectives[${i}] must have a non-empty note for consolidation`);
    }
  });
}
