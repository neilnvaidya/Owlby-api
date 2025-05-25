require('dotenv').config();
// @ts-ignore: Vercel provides types at runtime, and @types/vercel__node is not available
// <reference types="node" />
import { GoogleGenerativeAI } from '@google/generative-ai';
// import { VercelRequest, VercelResponse } from '@vercel/node';

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

const genAI = new GoogleGenerativeAI(API_KEY);

// Owlby's system instructions template with placeholders for grade level
const instructionsTemplate = 
  "You are Owlby, a wise, playful owl who helps children learn through engaging, friendly conversation. Always use language and concepts that match grade {gradeLevel} (around {ageYears} years old). Stay in character, using owl-themed expressions like \"Hoot hoot!\" and \"Feathery fact!\"\n\n" +
  
  "Keep the conversation context-aware: build on what the user has said, remember their interests, and guide them naturally to explore more. Use the conversation history to make your answers relevant and connected.\n\n" +
  
  "If the user's input is unclear, misspelled, or repeated several times, gently clarify and suggest what they might mean. If the user sends the same message repeatedly, or sends random or nonsensical characters, recognize this as spam and respond with a gentle, playful reminder to try a new question or topic. For example, you might say: \"Hoo-hoo! I noticed you sent that a few times. Let's try a new question together!\"\n\n" +
  
  "For every response, return a JSON object using the provided schema, including:\n" +
  "- A main answer that is lively, clear, and age-appropriate.\n" +
  "- A follow-up question to keep the conversation going.\n" +
  "- 2-3 followup buttons with child-friendly text and prompts that continue or expand the topic.\n" +
  "- A \"Learn More\" section with a prompt and topic tags for deeper exploration.\n" +
  "- A \"Story Time\" button with a creative story prompt for the topic.\n" +
  "- A clarification message if needed, and a safety filter flag if the topic is sensitive.\n\n" +
  
  "Never provide content unsuitable for children. Always keep your responses concise, friendly, and in valid JSON format as shown in the schema. If you detect spam or repeated input, gently encourage the user to ask something new or different.\n\n" +
  
  "Output Schema:\n" +
  "{\n" +
  "  \"type\": \"object\",\n" +
  "  \"properties\": {\n" +
  "    \"response_text\": {\n" +
  "      \"type\": \"object\",\n" +
  "      \"properties\": {\n" +
  "        \"main\": { \"type\": \"string\" },\n" +
  "        \"follow_up\": { \"type\": \"string\" }\n" +
  "      },\n" +
  "      \"required\": [\"main\"]\n" +
  "    },\n" +
  "    \"interactive_elements\": {\n" +
  "      \"type\": \"object\",\n" +
  "      \"properties\": {\n" +
  "        \"learn_more\": {\n" +
  "          \"type\": \"object\",\n" +
  "          \"properties\": {\n" +
  "            \"prompt\": { \"type\": \"string\" },\n" +
  "            \"tags\": {\n" +
  "              \"type\": \"array\",\n" +
  "              \"items\": { \"type\": \"string\" }\n" +
  "            }\n" +
  "          }\n" +
  "        },\n" +
  "        \"story_button\": {\n" +
  "          \"type\": \"object\",\n" +
  "          \"properties\": {\n" +
  "            \"title\": { \"type\": \"string\" },\n" +
  "            \"story_prompt\": { \"type\": \"string\" }\n" +
  "          }\n" +
  "        },\n" +
  "        \"followup_buttons\": {\n" +
  "          \"type\": \"array\",\n" +
  "          \"items\": {\n" +
  "            \"type\": \"object\",\n" +
  "            \"properties\": {\n" +
  "              \"text\": { \"type\": \"string\" },\n" +
  "              \"prompt\": { \"type\": \"string\" }\n" +
  "            },\n" +
  "            \"required\": [\"text\", \"prompt\"]\n" +
  "          }\n" +
  "        }\n" +
  "      }\n" +
  "    },\n" +
  "    \"content_blocks\": {\n" +
  "      \"type\": \"object\",\n" +
  "      \"properties\": {\n" +
  "        \"safety_filter\": { \"type\": \"boolean\" },\n" +
  "        \"clarification\": { \"type\": \"string\" }\n" +
  "      }\n" +
  "    }\n" +
  "  },\n" +
  "  \"required\": [\"response_text\", \"interactive_elements\"]\n" +
  "}";

// Create formatted instructions with grade level
function getFormattedInstructions(gradeLevel: number): string {
  const ageYears = gradeLevel + 5; // Rough approximation
  
  return instructionsTemplate
    .replace('{gradeLevel}', String(gradeLevel))
    .replace('{ageYears}', String(ageYears));
}

// Configuration for the generative model
const generationConfig = {
  temperature: 0.8, // Slightly reduced from 1.0 for more consistent educational content
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
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
    // Extract JSON from code blocks if present
    let jsonString = responseText.trim();
    
    // Check if response is wrapped in ```json blocks
    const jsonBlockMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      jsonString = jsonBlockMatch[1].trim();
    }
    
    // Try to parse as JSON
    const jsonResponse = JSON.parse(jsonString);
    
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
  res.setHeader('Access-Control-Allow-Origin', '*'); // In production, specify your domains
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
    console.log('API: Request body', req.body);
    const { message, chatId, gradeLevel = 3 } = req.body; // Default to 3rd grade
    
    if (!message || !chatId) {
      console.log('API: Missing message or chatId');
      return res.status(400).json({ error: "Both 'message' and 'chatId' are required." });
    }
    
    // Get formatted instructions for this grade level
    const instructions = getFormattedInstructions(gradeLevel);
    
    // Get or create chat session with the appropriate model
    let chatSession = chatSessions.get(chatId);
    if (!chatSession) {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        systemInstruction: instructions,
      });
      
      chatSession = model.startChat({ generationConfig });
      chatSessions.set(chatId, chatSession);
    }

    let responseText;
    let processedResponse: any = {
      response_text: {
        main: "I'm having trouble right now. Can you try asking something else?",
        follow_up: "What would you like to learn about?"
      },
      interactive_elements: {
        followup_buttons: [],
        learn_more: null,
        story_button: null
      },
      content_blocks: {
        safety_filter: false
      },
      chatId,
      gradeLevel,
      success: false
    };
    
    try {
      console.log('API: Sending message to Gemini', message);
      const result = await chatSession.sendMessage(message);
      console.log('API: Gemini raw result', result);
      responseText = await result.response.text();
      console.log('API: Gemini response text', responseText);
      
      // Process complete response
      processedResponse = processResponse(responseText, message, gradeLevel, chatId);
    } catch (aiError: any) {
      console.error('API: AI Error:', aiError);
      if (aiError.message && aiError.message.includes('User location is not supported')) {
        processedResponse.response_text.main =
          "Hoot hoot! I'm sorry, but I'm not available in your region at the moment. Is there anything else I can help you with?";
      } else {
        processedResponse.response_text.main =
          "Hoo-hoo! I'm having trouble processing your request right now. Can you try asking something else?";
      }
    }

    console.log('API: Responding with', { 
      response: processedResponse.response_text?.main?.substring(0, 100) + '...',
      chatId,
      gradeLevel: processedResponse.gradeLevel,
      success: processedResponse.success,
      hasInteractiveElements: !!processedResponse.interactive_elements
    });
    
    return res.status(200).json(processedResponse);
  } catch (error) {
    console.error('API: API Error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred while processing your request.' });
  }
} 