import { Type } from '@google/genai';
import { ACHIEVEMENT_TAG_ENUM } from './badgeCategories.js';

/**
 * Tags schema and instructions in one place for chat, lesson, and story.
 * Edit here to change how requiredCategoryTags and optionalTags are defined and described.
 */

// ---------------------------------------------------------------------------
// Schema fragment (append to chat / lesson / story response schemas)
// ---------------------------------------------------------------------------

export const TAGS_SCHEMA_FRAGMENT = {
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
} as const;

// ---------------------------------------------------------------------------
// Instructions (append to chat / lesson / story instruction builders)
// ---------------------------------------------------------------------------

export const TAGS_OUTPUT_RULES = `
TAGS OUTPUT RULES:
- requiredCategoryTags: 1–3 UPPERCASE ENUM values from [${ACHIEVEMENT_TAG_ENUM.join(', ')}]; these are TOPIC categories only. Do NOT include usage/behavior categories like CHAT_CHAMPION, DAILY_LEARNER, EXPLORATION_MASTER, LEARNING_STREAK.
- optionalTags (REQUIRED): 3–10 detailed context tags as free-form strings (e.g., specific people, places, concepts mentioned). These carry context to lesson/story routes. Do NOT include PII.`;
