import { Type } from '@google/genai';

// Unified response schema for Owlby chat API – exported for reuse
export const chatResponseSchema = {
  type: Type.OBJECT,
  required: ["response_text", "interactive_elements", "session_delta"],
  properties: {
    response_text: {
      type: Type.OBJECT,
      required: ["main", "follow_up"],
      properties: {
        main: { type: Type.STRING },
        follow_up: { type: Type.STRING }
      }
    },
    interactive_elements: {
      type: Type.OBJECT,
      required: ["followup_buttons"],
      properties: {
        followup_buttons: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        story_button: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            story_prompt: { type: Type.STRING }
          }
        },
        learn_more: {
          type: Type.OBJECT,
          properties: {
            prompt: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    },
    session_delta: {
      type: Type.OBJECT,
      properties: {
        pedagogy_flags: { type: Type.ARRAY, items: { type: Type.STRING } },
        topic_updates: {
          type: Type.OBJECT,
          properties: {
            current_topic: { type: Type.STRING },
            topic_shift: { type: Type.BOOLEAN }
          }
        },
        learning_analysis: {
          type: Type.OBJECT,
          properties: {
            comprehension_level: { type: Type.STRING },
            question_type_detected: { type: Type.STRING }
          }
        },
        engagement_analysis: {
          type: Type.OBJECT,
          properties: {
            engagement_change: { type: Type.STRING }
          }
        }
      }
    }
  }
} as const; 