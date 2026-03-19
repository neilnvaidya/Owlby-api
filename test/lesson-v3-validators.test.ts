import {
  parseLessonObjectivesState,
  validateLessonObjectivesForChunk,
  validateLessonObjectivesForConsolidation,
  validateLessonObjectivesAfterRoute2,
} from '../lib/lesson-v3-types.js';

describe('lesson v3 validators', () => {
  const validLo = (over: Partial<ReturnType<typeof parseLessonObjectivesState>> = {}) => {
    const base = parseLessonObjectivesState({
      student_age: 10,
      topic: 'Photosynthesis',
      current_index: 0,
      objectives: [
        { title: 'Explain X', status: 'current', note: null },
        { title: 'Describe Y', status: 'pending', note: null },
      ],
    });
    return { ...base, ...over };
  };

  it('validateLessonObjectivesForChunk requires exactly one current', () => {
    const lo = validLo();
    expect(() => validateLessonObjectivesForChunk(lo)).not.toThrow();
    const bad = validLo({
      objectives: [
        { title: 'A', status: 'current', note: null },
        { title: 'B', status: 'current', note: null },
      ],
    });
    expect(() => validateLessonObjectivesForChunk(bad)).toThrow();
  });

  it('validateLessonObjectivesForConsolidation rejects single objective', () => {
    const one = parseLessonObjectivesState({
      student_age: 7,
      topic: 'T',
      current_index: 1,
      objectives: [{ title: 'A', status: 'complete', note: 'n' }],
    });
    expect(() => validateLessonObjectivesForConsolidation(one)).toThrow();
  });

  it('validateLessonObjectivesForConsolidation accepts all complete', () => {
    const lo = parseLessonObjectivesState({
      student_age: 10,
      topic: 'T',
      current_index: 2,
      objectives: [
        { title: 'A', status: 'complete', note: 'n1' },
        { title: 'B', status: 'complete', note: 'n2' },
      ],
    });
    expect(() => validateLessonObjectivesForConsolidation(lo)).not.toThrow();
  });

  it('validateLessonObjectivesAfterRoute2 enforces count and index 0', () => {
    const lo = parseLessonObjectivesState({
      student_age: 10,
      topic: 'T',
      current_index: 0,
      objectives: [
        { title: 'A', status: 'current', note: null },
        { title: 'B', status: 'pending', note: null },
      ],
    });
    expect(() => validateLessonObjectivesAfterRoute2(lo, 2, 10)).not.toThrow();
    expect(() => validateLessonObjectivesAfterRoute2(lo, 3, 10)).toThrow();
  });
});
