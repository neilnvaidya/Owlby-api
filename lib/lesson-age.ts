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
      return 2;
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

/**
 * Reading-level / vocabulary guidance per age band.
 * Sentence COUNT is controlled separately (getMaxSentencesForContent); this controls
 * WORD CHOICE and sentence LENGTH so language is genuinely age-appropriate, not just short.
 * Injected into the lesson prompts (start, objectives, chunk).
 */
export function getReadingLevelGuidance(age: number): string {
  const band = getAgeBandV3(age);
  switch (band) {
    case '5-7':
      return `READING LEVEL (STRICT — kindergarten / grade 1, age ${age}):
- Use ONLY words a 5–6 year old already knows. Everyday, concrete words for things they can see, touch, or do.
- NO technical, abstract, or "grown-up" words. If a real term is hard (e.g. "photosynthesis", "evaporate"), do NOT use it — describe the idea in plain words instead, or skip it.
- Very short sentences: about 5–9 words each. One idea per sentence.
- Prefer simple verbs (make, get, eat, grow) over formal ones (produce, obtain, consume, develop).
- Good style example: "Plants drink water. The sun helps them grow. Leaves catch sunlight to make food."`;
    case '8-11':
      return `READING LEVEL (grade 2–4, age ${age}):
- Simple, everyday vocabulary a 9–11 year old reads comfortably.
- Introduce at most ONE new term, and explain it in plain words in the same sentence.
- Short sentences: about 8–14 words. Use a concrete example a child can picture.
- Prefer plain verbs and nouns over formal/abstract ones.`;
    case '12-15':
      return `READING LEVEL (grade 6–8, age ${age}):
- Clear, plain language. Define any technical term the first time you use it.
- Sentences of moderate length; avoid dense or academic phrasing.`;
    default:
      return `READING LEVEL (grade 9–11, age ${age}):
- Precise vocabulary and correct technical terms are fine, but keep sentences clear and direct.
- Explain specialised jargon briefly on first use.`;
  }
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
