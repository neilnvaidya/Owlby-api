import { getObjectiveCountForAge, getExpectedChunkQuestionType } from '../lib/lesson-age.js';

describe('lesson v3 age rules', () => {
  it('objective counts by age', () => {
    expect(getObjectiveCountForAge(6)).toBe(2);
    expect(getObjectiveCountForAge(9)).toBe(2);
    expect(getObjectiveCountForAge(14)).toBe(3);
    expect(getObjectiveCountForAge(17)).toBe(4);
  });

  it('chunk question types by age', () => {
    expect(getExpectedChunkQuestionType(6)).toBe('mcq');
    expect(getExpectedChunkQuestionType(10)).toBe('mcq');
    expect(getExpectedChunkQuestionType(13)).toBe('short_answer');
    expect(getExpectedChunkQuestionType(17)).toBe('higher_order');
  });
});
