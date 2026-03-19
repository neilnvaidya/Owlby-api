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
        { title: 'Explain X', key_facts: ['Fact 1', 'Fact 2'], status: 'current', note: null },
        { title: 'Describe Y', key_facts: ['Fact 3', 'Fact 4'], status: 'pending', note: null },
      ],
    });
    return { ...base, ...over };
  };

  it('validateLessonObjectivesForChunk requires exactly one current', () => {
    const lo = validLo();
    expect(() => validateLessonObjectivesForChunk(lo)).not.toThrow();
    const bad = validLo({
      objectives: [
        { title: 'A', key_facts: ['a1', 'a2'], status: 'current', note: null },
        { title: 'B', key_facts: ['b1', 'b2'], status: 'current', note: null },
      ],
    });
    expect(() => validateLessonObjectivesForChunk(bad)).toThrow();
  });

  it('validateLessonObjectivesForConsolidation rejects single objective', () => {
    const one = parseLessonObjectivesState({
      student_age: 7,
      topic: 'T',
      current_index: 1,
      objectives: [{ title: 'A', key_facts: ['a1', 'a2'], status: 'complete', note: 'n' }],
    });
    expect(() => validateLessonObjectivesForConsolidation(one)).toThrow();
  });

  it('validateLessonObjectivesForConsolidation accepts all complete', () => {
    const lo = parseLessonObjectivesState({
      student_age: 10,
      topic: 'T',
      current_index: 2,
      objectives: [
        { title: 'A', key_facts: ['a1', 'a2'], status: 'complete', note: 'n1' },
        { title: 'B', key_facts: ['b1', 'b2'], status: 'complete', note: 'n2' },
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
        { title: 'A', key_facts: ['a1', 'a2'], status: 'current', note: null },
        { title: 'B', key_facts: ['b1', 'b2'], status: 'pending', note: null },
      ],
    });
    expect(() => validateLessonObjectivesAfterRoute2(lo, 2, 10)).not.toThrow();
    expect(() => validateLessonObjectivesAfterRoute2(lo, 3, 10)).toThrow();
  });
});
