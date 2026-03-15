import { Type } from '@google/genai';
import { ACHIEVEMENT_TAG_ENUM } from './badgeCategories.js';

/**
 * Centralized AI Response Schemas for Owlby
 * All schemas include standardized achievement tag fields for consistency
 */

/**
 * Base achievement tags schema used across all endpoints
 */
const ACHIEVEMENT_TAGS_SCHEMA = {
  // Deprecated: kept for backward compatibility
  tags: { 
    type: Type.ARRAY, 
    items: { type: Type.STRING, enum: ACHIEVEMENT_TAG_ENUM as any } 
  },
  // Current: required category tags for achievement system
  requiredCategoryTags: { 
    type: Type.ARRAY, 
    items: { type: Type.STRING, enum: ACHIEVEMENT_TAG_ENUM as any } 
  },
  // Current: required detailed context tags (passed to lesson/story routes)
  optionalTags: { 
    type: Type.ARRAY, 
    items: { type: Type.STRING },
    description: "Required detailed context tags that carry specific information (people, places, concepts) to lesson/story routes"
  }
};

/**
 * Tags-only response schema for the dedicated tags API
 * Used when generating only requiredCategoryTags and optionalTags from context
 */
export const tagsResponseSchema = {
  type: Type.OBJECT,
  required: ['requiredCategoryTags', 'optionalTags'],
  properties: {
    requiredCategoryTags: {
      type: Type.ARRAY,
      items: { type: Type.STRING, enum: ACHIEVEMENT_TAG_ENUM as any },
      description: 'Exactly 1 topic category from the enum',
    },
    optionalTags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '0–5 context tags (people, places, concepts). No PII.',
    },
  },
} as const;

/**
 * Chat response schema for conversational AI interactions (no tags – tags come from dedicated tags API)
 */
export const chatResponseSchema = {
  type: Type.OBJECT,
  required: ['response_text', 'interactive_elements'],
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
  },
} as const;

/**
 * Chat response schema WITH tags in one JSON (for testing / combined flow).
 * Same as chatResponseSchema plus requiredCategoryTags and optionalTags.
 */
export const chatResponseWithTagsSchema = {
  type: Type.OBJECT,
  required: ['response_text', 'interactive_elements', 'requiredCategoryTags', 'optionalTags'],
  properties: {
    ...chatResponseSchema.properties,
    requiredCategoryTags: {
      type: Type.ARRAY,
      items: { type: Type.STRING, enum: ACHIEVEMENT_TAG_ENUM as any },
      description: '1–3 topic categories from the enum (TOPIC only, no usage/behavior categories).',
    },
    optionalTags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '3–10 context tags (concepts, places, terms). No PII.',
    },
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
        ...ACHIEVEMENT_TAGS_SCHEMA,
      }
    }
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
        ...ACHIEVEMENT_TAGS_SCHEMA,
      }
    }
  }
} as const;
