import { config } from 'dotenv';
import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  Type,
} from '@google/genai';
import { logStoryCall, flushApiLogger } from '../../lib/api-logger';

// Use regular console for API logging

config();

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

const ai = new GoogleGenAI({
  apiKey: API_KEY,
});

/**
 * Story Generation API for Owlby
 * Generates engaging, child-friendly stories based on prompts from chat
 */

const getStoryConfig = (prompt: string, gradeLevel: number) => {
  const ageYears = gradeLevel + 5; // Grade 1 = ~6 years old, Grade 3 = ~8 years old, etc.
  
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
            }
          }
        }
      }
    },
    systemInstruction: [
      {
        text: `Create an engaging story based on the prompt: "${prompt}" for grade ${gradeLevel} (${ageYears} years old).

You are Owlby, a wise and playful owl storyteller. Create stories that are:
- Age-appropriate for ${ageYears}-year-olds
- Engaging and imaginative
- Educational when possible
- Positive and encouraging
- Safe and appropriate for children

Structure your response as JSON matching the schema:
- **Title**: Catchy, under 50 characters
- **Content**: Break story into 4-6 paragraphs, each 2-4 sentences
- **Characters**: List main characters
- **Setting**: Describe where/when story happens
- **Moral**: Optional lesson (keep it light and natural)

Use your friendly Owlby personality with occasional "Hoot hoot!" expressions. Make the story vivid and fun while keeping language appropriate for the grade level.`
      }
    ]
  };
};

/**
 * Process the JSON response from the new API format
 * @param responseText The raw response from Gemini (should be JSON)
 * @returns Processed story response
 */
function processStoryResponse(responseText: string, prompt: string, gradeLevel: number) {
  try {
    // Parse the JSON response
    const jsonResponse = JSON.parse(responseText);
    
    // Validate the expected structure
    if (jsonResponse.story) {
      const story = jsonResponse.story;
      return {
        prompt: prompt,
        gradeLevel: gradeLevel,
        title: story.title,
        content: story.content || [],
        characters: story.characters || [],
        setting: story.setting || '',
        moral: story.moral || '',
        timestamp: new Date().toISOString()
      };
    } else {
      throw new Error('Invalid story JSON structure');
    }
  } catch (error) {
    console.error('Failed to parse story JSON response:', error);
    throw new Error(`Failed to generate story: Invalid response format. Please try again.`);
  }
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

  const startTime = Date.now();
  const { prompt, gradeLevel = 3, userId } = req.body;
  const model = 'gemini-2.5-flash';
    
    if (!prompt) {
      console.info('❌ Missing story prompt');
      logStoryCall({
        userId,
        gradeLevel,
        prompt: prompt || 'unknown',
        responseTimeMs: Date.now() - startTime,
        success: false,
        error: 'BadRequest',
        model,
      });
      await flushApiLogger();
      return res.status(400).json({ error: "Story prompt is required." });
    }

  try {
    console.info('📖 Story Generate API: Request received', req.body);
    
    // Get the configuration for this story
    const config = getStoryConfig(prompt, gradeLevel);
    
    // Create the contents array with user input
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: `prompt = ${prompt}, grade ${gradeLevel}, age ${gradeLevel + 5}`,
          },
        ],
      },
    ];

    console.info('📖 Sending story request to Gemini for prompt:', prompt);
    const response = await ai.models.generateContent({
      model,
      config,
      contents,
    });
    
    console.info('📖 Gemini raw result received');
    const responseText = response.text || '';
    console.info('📖 Gemini response text:', responseText.substring(0, 200) + '...');
    // Log detailed token usage and cost analysis
    console.info('🔍 [STORY API] Detailed token breakdown:', {
      input_analysis: {
        prompt_length: prompt.length,
        full_prompt_estimate: prompt.length + 150, // prompt + system prompt overhead
        actual_input_tokens: response.usageMetadata?.promptTokenCount
      },
      output_analysis: {
        response_length: responseText.length,
        estimated_output_tokens: Math.ceil(responseText.length / 4),
        actual_output_tokens: response.usageMetadata?.candidatesTokenCount
      },
      gemini_usage_metadata: response.usageMetadata,
      efficiency_metrics: {
        chars_per_input_token: response.usageMetadata?.promptTokenCount ? (prompt.length / response.usageMetadata.promptTokenCount).toFixed(2) : 'N/A',
        chars_per_output_token: response.usageMetadata?.candidatesTokenCount ? (responseText.length / response.usageMetadata.candidatesTokenCount).toFixed(2) : 'N/A',
        output_input_ratio: response.usageMetadata?.candidatesTokenCount && response.usageMetadata?.promptTokenCount ? 
          (response.usageMetadata.candidatesTokenCount / response.usageMetadata.promptTokenCount).toFixed(2) : 'N/A'
      }
    });
    // Process complete response - this will throw if parsing fails
    const processedResponse = processStoryResponse(responseText, prompt, gradeLevel);

    logStoryCall({
      userId,
      gradeLevel,
      prompt,
      responseText,
      responseTimeMs: Date.now() - startTime,
      success: true,
      usageMetadata: response.usageMetadata,
      model,
    });
    await flushApiLogger();

    console.info('✅ Story Generate API: Responding with story for prompt:', prompt);
    
    return res.status(200).json(processedResponse);
    
  } catch (error: any) {
    console.error('❌ Story Generate API: Error occurred', error);
    logStoryCall({
      userId,
      gradeLevel,
      prompt,
      responseTimeMs: Date.now() - startTime,
      success: false,
      error: error.message || 'UnknownError',
      model,
    });
    await flushApiLogger();
    if (error.message && error.message.includes('User location is not supported')) {
      return res.status(503).json({ 
        error: 'Story generation not available in your region',
        fallback: true
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to generate story. Please try again.',
      details: error.message || 'Unknown error occurred'
    });
  }
} 