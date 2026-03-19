import { Type } from '@google/genai';
import { ACHIEVEMENT_TAG_ENUM } from './badgeCategories.js';
import { TAGS_SCHEMA_FRAGMENT } from './ai-tags.js';

/**
 * Centralized AI Response Schemas for Owlby
 * Tag fields (requiredCategoryTags, optionalTags) come from lib/ai-tags.ts for all routes.
 */

/**
 * Chat response schema (includes tags; see lib/ai-tags.ts for tag definitions).
 */
export const chatResponseSchema = {
  type: Type.OBJECT,
  required: ['response_text', 'interactive_elements', 'requiredCategoryTags', 'optionalTags'],
  properties: {
    response_text: {
      type: Type.OBJECT,
      required: ['main'],
      properties: {
        main: {
          type: Type.STRING,
          description: 'Complete response text, 300-1000 characters. Must be complete sentences, never truncated.',
        },
        follow_up: {
          type: Type.STRING,
          description: 'Complete follow-up question, 50-200 characters. Must end with a question mark.',
        },
      },
    },
    interactive_elements: {
      type: Type.OBJECT,
      required: ['followup_buttons', 'story_button', 'learn_more'],
      properties: {
        followup_buttons: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        story_button: {
          type: Type.OBJECT,
          properties: {
            prompt: { type: Type.STRING },
          },
        },
        learn_more: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING },
          },
        },
      },
    },
    ...TAGS_SCHEMA_FRAGMENT,
  },
} as const;

/**
 * Lesson response schema for educational content generation
 */
export const lessonResponseSchema = {
  type: Type.OBJECT,
  required: ["lesson"],
  properties: {
    lesson: {
      type: Type.OBJECT,
      required: ["title", "introduction", "body", "conclusion", "keyPoints", "keywords", "challengeQuiz"],
      properties: {
        title: { type: Type.STRING },
        introduction: { type: Type.STRING },
        body: { type: Type.ARRAY, items: { type: Type.STRING } },
        conclusion: { type: Type.STRING },
        keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
        keywords: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            required: ["term", "definition"],
            properties: {
              term: { type: Type.STRING },
              definition: { type: Type.STRING }
            }
          }
        },
        difficulty: { type: Type.INTEGER },
        challengeQuiz: {
          type: Type.OBJECT,
          required: ["questions"],
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["question", "options", "correctAnswerIndex", "explanation"],
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswerIndex: { type: Type.INTEGER },
                  explanation: { type: Type.STRING }
                }
              }
            }
          }
        },
        ...TAGS_SCHEMA_FRAGMENT,
      }
    }
  },
} as const;

// =============================================================================
// Lesson System v3 — five-route schemas (Part 8)
// =============================================================================

export const lessonV3StartResponseSchema = {
  type: Type.OBJECT,
  required: ['hook', 'question'],
  properties: {
    hook: { type: Type.STRING, description: 'One vivid hook sentence, not a question' },
    question: { type: Type.STRING, description: 'Open-ended prior knowledge question' },
  },
} as const;

const lessonV3ObjectiveEntrySchema = {
  type: Type.OBJECT,
  required: ['title', 'status', 'note'],
  properties: {
    title: { type: Type.STRING },
    status: { type: Type.STRING, enum: ['pending', 'current', 'complete'] },
    note: { type: Type.STRING, nullable: true },
  },
};

const lessonV3ObjectivesStateSchema = {
  type: Type.OBJECT,
  required: ['student_age', 'topic', 'objectives', 'current_index'],
  properties: {
    student_age: { type: Type.INTEGER },
    topic: { type: Type.STRING },
    current_index: { type: Type.INTEGER },
    objectives: {
      type: Type.ARRAY,
      items: lessonV3ObjectiveEntrySchema,
      minItems: 1,
      maxItems: 4,
    },
  },
};

export const lessonV3ObjectivesResponseSchema = {
  type: Type.OBJECT,
  required: ['bridge_message', 'lesson_objectives'],
  properties: {
    bridge_message: { type: Type.STRING },
    lesson_objectives: lessonV3ObjectivesStateSchema,
  },
} as const;

export const lessonV3ChunkResponseSchema = {
  type: Type.OBJECT,
  required: ['content', 'question', 'question_type', 'mcq_options', 'correct_answer'],
  properties: {
    content: { type: Type.STRING },
    question: { type: Type.STRING },
    question_type: {
      type: Type.STRING,
      enum: ['mcq', 'short_answer', 'higher_order'],
    },
    mcq_options: { type: Type.ARRAY, items: { type: Type.STRING } },
    correct_answer: { type: Type.STRING, nullable: true },
  },
} as const;

export const lessonV3EvaluateResponseSchema = {
  type: Type.OBJECT,
  required: ['result', 'feedback', 'note'],
  properties: {
    result: { type: Type.STRING, enum: ['correct', 'partial', 'incorrect'] },
    feedback: { type: Type.STRING },
    note: { type: Type.STRING },
  },
} as const;

const lessonV3ConsolidationMcqItemSchema = {
  type: Type.OBJECT,
  required: ['question', 'options', 'correct_answer', 'explanation'],
  properties: {
    question: { type: Type.STRING },
    options: { type: Type.ARRAY, items: { type: Type.STRING } },
    correct_answer: { type: Type.STRING },
    explanation: { type: Type.STRING },
  },
};

export const lessonV3ConsolidationResponseSchema = {
  type: Type.OBJECT,
  required: ['mcq_sweep', 'explain_back_prompt', 'closing_message', 'lesson_complete'],
  properties: {
    mcq_sweep: { type: Type.ARRAY, items: lessonV3ConsolidationMcqItemSchema },
    explain_back_prompt: { type: Type.STRING },
    closing_message: { type: Type.STRING },
    lesson_complete: { type: Type.BOOLEAN },
  },
} as const;

/**
 * Story response schema for narrative content generation
 */
export const storyResponseSchema = {
  type: Type.OBJECT,
  required: ["story"],
  properties: {
    story: {
      type: Type.OBJECT,
      required: ["title", "content", "characters", "setting"],
      properties: {
        title: {
          type: Type.STRING,
          description: "Engaging story title, under 50 characters"
        },
        content: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
            description: "Story paragraphs, each 2-4 sentences"
          },
          description: "Story broken into engaging paragraphs"
        },
        characters: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          },
          description: "Main characters in the story"
        },
        setting: {
          type: Type.STRING,
          description: "Where and when the story takes place"
        },
        moral: {
          type: Type.STRING,
          description: "Optional lesson or moral from the story"
        },
        ...TAGS_SCHEMA_FRAGMENT,
      }
    }
  }
} as const;
