/**
 * Lesson v3 age rules — Part 7 (single source of truth for API + prompts).
 */

export type AgeBandV3 = '5-7' | '8-11' | '12-15' | '16-18';

export function getAgeBandV3(age: number): AgeBandV3 {
  if (age <= 7) return '5-7';
  if (age <= 11) return '8-11';
  if (age <= 15) return '12-15';
  return '16-18';
}

/** Part 7.2 — number of objectives */
export function getObjectiveCountForAge(age: number): number {
  const band = getAgeBandV3(age);
  switch (band) {
    case '5-7':
      return 1;
    case '8-11':
      return 2;
    case '12-15':
      return 3;
    case '16-18':
      return 4;
    default:
      return 1;
  }
}

/** Part 7.4 — chunk question type */
export function getExpectedChunkQuestionType(age: number): 'mcq' | 'short_answer' | 'higher_order' {
  const band = getAgeBandV3(age);
  if (band === '5-7' || band === '8-11') return 'mcq';
  if (band === '12-15') return 'short_answer';
  return 'higher_order';
}

/** MCQ option count for chunk (5–7: 2, 8–11: 3) and consolidation sweep (5–7: 2, else 3) */
export function getMcqOptionCountForChunk(age: number): number {
  return getAgeBandV3(age) === '5-7' ? 2 : 3;
}

/** Part 7.9 — consolidation sweep options */
export function getMcqOptionCountForConsolidation(age: number): number {
  return getAgeBandV3(age) === '5-7' ? 2 : 3;
}

/** Part 8.1 — student_age 5–18 */
export function isValidStudentAge(age: number): boolean {
  return Number.isInteger(age) && age >= 5 && age <= 18;
}

/** Part 7.3 — max sentences for teaching content */
export function getMaxSentencesForContent(age: number): number {
  const band = getAgeBandV3(age);
  switch (band) {
    case '5-7':
      return 2;
    case '8-11':
      return 3;
    case '12-15':
      return 4;
    case '16-18':
      return 5;
    default:
      return 3;
  }
}
