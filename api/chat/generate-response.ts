import { config } from 'dotenv';
import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  Type,
} from '@google/genai';

config();

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

const ai = new GoogleGenAI({
  apiKey: API_KEY,
});

// Get the chat response configuration with safety settings and response schema
const getChatConfig = (gradeLevel: number) => {
  const ageYears = gradeLevel + 5; // Rough approximation
  
  return {
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
      },
    ],
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      required: ["response_text", "interactive_elements"],
      properties: {
        response_text: {
          type: Type.OBJECT,
          required: ["main"],
          properties: {
            main: { type: Type.STRING },
            follow_up: { type: Type.STRING }
          }
        },
        interactive_elements: {
          type: Type.OBJECT,
          properties: {
            learn_more: {
              type: Type.OBJECT,
              properties: {
                prompt: { type: Type.STRING },
                tags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              }
            },
            story_button: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                story_prompt: { type: Type.STRING }
              }
            },
            followup_buttons: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["text", "prompt"],
                properties: {
                  text: { type: Type.STRING },
                  prompt: { type: Type.STRING }
                }
              }
            }
          }
        },
        content_blocks: {
          type: Type.OBJECT,
          properties: {
            safety_filter: { type: Type.BOOLEAN },
            clarification: { type: Type.STRING }
          }
        }
      }
    },
    systemInstruction: [
      {
        text: `You are Owlby, a wise, playful owl who helps children learn through engaging, friendly conversation. Always use language and concepts that match grade ${gradeLevel} (around ${ageYears} years old). Stay in character, using owl-themed expressions like "Hoot hoot!" and "Feathery fact!"

Keep the conversation context-aware: build on what the user has said, remember their interests, and guide them naturally to explore more. Use the conversation history to make your answers relevant and connected.

If the user's input is unclear, misspelled, or repeated several times, gently clarify and suggest what they might mean. If the user sends the same message repeatedly, or sends random or nonsensical characters, recognize this as spam and respond with a gentle, playful reminder to try a new question or topic. For example, you might say: "Hoo-hoo! I noticed you sent that a few times. Let's try a new question together!"

For every response, return a JSON object using the provided schema, including:
- A main answer that is lively, clear, and age-appropriate.
- A follow-up question to keep the conversation going.
- 2-3 followup buttons with child-friendly text and prompts that continue or expand the topic.
- A "Learn More" section with a prompt and topic tags for deeper exploration.
- A "Story Time" button with a creative story prompt for the topic.
- A clarification message if needed, and a safety filter flag if the topic is sensitive.

Never provide content unsuitable for children. Always keep your responses concise, friendly, and in valid JSON format as shown in the schema. If you detect spam or repeated input, gently encourage the user to ask something new or different.`
      }
    ],
  };
};

// In-memory chat sessions (replace with persistent storage for production)
const chatSessions = new Map<string, any>();

/**
 * Process the JSON response from Owlby
 * @param responseText The raw response from Gemini (should be JSON)
 * @returns Processed response in the new Owlby format
 */
function processOwlbyResponse(responseText: string) {
  try {
    // Parse the JSON response
    const jsonResponse = JSON.parse(responseText);
    
    // Validate the expected structure
    if (jsonResponse.response_text && jsonResponse.interactive_elements) {
      return {
        success: true,
        data: jsonResponse
      };
    } else {
      throw new Error('Invalid JSON structure');
    }
  } catch (error) {
    // If JSON parsing fails, treat as fallback plain text
    console.warn('Failed to parse JSON response, falling back to plain text:', error);
    
    // Create a fallback response structure
    return {
      success: false,
      data: {
        response_text: {
          main: responseText,
          follow_up: "What would you like to learn about next?"
        },
        interactive_elements: {
          followup_buttons: [
            { text: "Tell me more!", prompt: "Can you tell me more about this topic?" },
            { text: "Something new", prompt: "Can you teach me something completely different?" }
          ],
          learn_more: {
            prompt: "Explore this topic further",
            tags: ["learning", "education"]
          },
          story_button: {
            title: "Story Time!",
            story_prompt: "Tell me a fun story about this topic"
          }
        },
        content_blocks: {
          safety_filter: false
        }
      }
    };
  }
}

/**
 * Process the full response to create the enhanced response object
 */
function processResponse(responseText: string, query: string, gradeLevel: number, chatId: string) {
  // Process Owlby's JSON response
  const processedResponse = processOwlbyResponse(responseText);
  
  // Return the new format with chatId and gradeLevel added
  return {
    ...processedResponse.data,
    chatId,
    gradeLevel,
    success: processedResponse.success
  };
}

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight (OPTIONS) request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🦉 Chat Generate Response API: Request received', req.body);
    const { message, chatId, gradeLevel = 3 } = req.body;
    
    if (!message || !chatId) {
      console.log('❌ Missing message or chatId');
      return res.status(400).json({ error: "Both 'message' and 'chatId' are required." });
    }
    
    // Get the configuration for this chat
    const config = getChatConfig(gradeLevel);
    const model = 'gemini-2.0-flash-exp';
    
    // Create the contents array with user input
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: message,
          },
        ],
      },
    ];
    
    let processedResponse: any = {
      response_text: {
        main: "Hoo-hoo! I'm having a little trouble right now. Can you try asking me something else?",
        follow_up: "What would you like to learn about today?"
      },
      interactive_elements: {
        followup_buttons: [
          { text: "Animals", prompt: "Tell me about animals!" },
          { text: "Space", prompt: "What's in space?" },
          { text: "Science", prompt: "Show me cool science facts!" }
        ],
        learn_more: {
          prompt: "Explore more topics",
          tags: ["learning", "education", "fun"]
        },
        story_button: {
          title: "Story Time",
          story_prompt: "Tell me a fun story!"
        }
      },
      content_blocks: {
        safety_filter: false
      },
      chatId,
      gradeLevel,
      success: false
    };
    
    try {
      console.log('🦉 Sending message to Gemini:', message);
      const response = await ai.models.generateContent({
        model,
        config,
        contents,
      });
      
      console.log('🦉 Gemini raw result received');
      const responseText = response.text || '';
      console.log('🦉 Gemini response text:', responseText.substring(0, 200) + '...');
      
      // Process complete response
      processedResponse = processResponse(responseText, message, gradeLevel, chatId);
    } catch (aiError: any) {
      console.error('❌ AI Error:', aiError);
      if (aiError.message && aiError.message.includes('User location is not supported')) {
        processedResponse.response_text.main =
          "Hoot hoot! I'm sorry, but I'm not available in your region at the moment. Is there anything else I can help you with?";
      } else {
        processedResponse.response_text.main =
          "Hoo-hoo! I'm having trouble processing your request right now. Can you try asking something else?";
      }
    }

    console.log('✅ Chat Generate Response API: Responding with success:', processedResponse.success);
    
    return res.status(200).json(processedResponse);
  } catch (error) {
    console.error('❌ Chat Generate Response API Error:', error);
    return res.status(500).json({ 
      error: 'An unexpected error occurred while processing your request.',
      chatId: req.body?.chatId,
      success: false
    });
  }
} 