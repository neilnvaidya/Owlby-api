import { Type } from '@google/genai';
import { ACHIEVEMENT_TAG_ENUM } from './badgeCategories';

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
  // Current: optional tags for analytics
  optionalTags: { 
    type: Type.ARRAY, 
    items: { type: Type.STRING } 
  }
};

/**
 * Chat response schema for conversational AI interactions
 */
export const chatResponseSchema = {
  type: Type.OBJECT,
  required: ["response_text", "interactive_elements"],
  properties: {
    ...ACHIEVEMENT_TAGS_SCHEMA,
    response_text: {
      type: Type.OBJECT,
      required: ["main"],
      properties: {
        main: { 
          type: Type.STRING,
          description: "Complete response text, 300-1000 characters. Must be complete sentences, never truncated."
        },
        follow_up: { 
          type: Type.STRING,
          description: "Complete follow-up question, 50-200 characters. Must end with a question mark."
        },
      },
    },
    interactive_elements: {
      type: Type.OBJECT,
      required: ["followup_buttons", "story_button", "learn_more"],
      properties: {
        followup_buttons: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        story_button: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            story_prompt: { type: Type.STRING },
          },
        },
        learn_more: {
          type: Type.OBJECT,
          properties: {
            prompt: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
      },
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
        },
        // Optional CSS-based visual block for concepts that benefit from a simple diagram
        visual: {
          type: Type.OBJECT,
          properties: {
            type: { 
              type: Type.STRING,
              description: 'Visual type identifier',
              enum: ['css-diagram'] as any
            },
            title: {
              type: Type.STRING,
              description: 'Short descriptive title for the visual'
            },
            description: {
              type: Type.STRING,
              description: 'Brief explanation of what the visual shows'
            },
            html: {
              type: Type.STRING,
              description: 'Minimal HTML structure for the diagram'
            },
            css: {
              type: Type.STRING,
              description: 'Minimal CSS needed to render the diagram (boxes, lines, simple layouts only)'
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
