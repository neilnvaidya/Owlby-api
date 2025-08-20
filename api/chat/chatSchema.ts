import { Type } from '@google/genai';

// Unified response schema for Owlby chat API – exported for reuse
export const chatResponseSchema = {
  type: Type.OBJECT,
  required: ["response_text", "interactive_elements"],
  properties: {
    requiredCategoryTags: { type: Type.ARRAY, items: { type: Type.STRING } },
    optionalTags: { type: Type.ARRAY, items: { type: Type.STRING } },
    response_text: {
      type: Type.OBJECT,
      required: ["main"],
      properties: {
        main: { type: Type.STRING },
        follow_up: { type: Type.STRING },
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