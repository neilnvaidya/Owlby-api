import { config } from 'dotenv';
import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  Type,
} from '@google/genai';
import { logLessonCall, flushApiLogger } from '../../lib/api-logger';

// Use regular console for API logging

config();

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

const ai = new GoogleGenAI({
  apiKey: API_KEY,
});



// Get the lesson generation configuration with safety settings and response schema
const getLessonConfig = (topic: string, gradeLevel: number) => {
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
      required: ["lesson"],
      properties: {
        lesson: {
          type: Type.OBJECT,
          required: ["title", "introduction", "body", "conclusion", "keyPoints", "keywords", "quickQuiz"],
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
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            difficulty: { type: Type.INTEGER },
            quickQuiz: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["question", "options", "correctAnswerIndex"],
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswerIndex: { type: Type.INTEGER }
                }
              }
            }
          }
        }
      },
    },
    systemInstruction: [
      {
        text: `You are Owlby – a concise, engaging mentor.
Create a lesson about "${topic}" for grade ${gradeLevel} (approx. ${ageYears} y/o) in VALID JSON matching the provided schema.

Sections:
1. title – ≤50 chars, catchy, no quotes
2. introduction – ONE clear sentence that hooks interest
3. body – 1–4 short paragraphs, 100 - 250 characters each, scaling with user profile (array of strings)
4. conclusion – single wrap-up sentence
5. keyPoints – 2–5 bullet strings
6. keywords – 4–7 {term, definition} items, choose harder words for older/difficult lessons
7. tags – 2-8 lowercase single-word strings (e.g., space, biology)
8. difficulty – integer 0-20 (0=kinder, 20=8th-grade); pick realistically for content depth
9. quickQuiz – 3–5 MCQs; ALWAYS 4 options; answers in lesson; no explanations.

Use learner profile: { ageYears: ${ageYears}, gradeLevel: ${gradeLevel} }.

Return ONLY the JSON.`
      }
    ],
  };
};

/**
 * Process the JSON response from the new API format
 * @param responseText The raw response from Gemini (should be JSON)
 * @returns Processed lesson response
 */
function processLessonResponse(responseText: string, topic: string, gradeLevel: number) {
  try {
    // Parse the JSON response
    const jsonResponse = JSON.parse(responseText);
    
    // Validate the expected structure
    if (jsonResponse.lesson) {
      // Return the format that matches the React Native app's Lesson type
      const lesson = jsonResponse.lesson;
      return {
        topic: topic,
        gradeLevel: gradeLevel,
        title: lesson.title,
        introduction: lesson.introduction.replace(/\\n/g, '\n'),
        body: (lesson.body || []).map((p: string) => p.replace(/\\n/g, '\n')),
        conclusion: lesson.conclusion,
        keyPoints: lesson.keyPoints || [],
        keywords: lesson.keywords || [],
        quickQuiz: {
          questions: lesson.quickQuiz || []
        },
        tags: lesson.tags || [],
        difficulty: lesson.difficulty ?? 10,
      };
    } else {
      throw new Error('Invalid lesson JSON structure');
    }
  } catch (error) {
    console.error('Failed to parse lesson JSON response:', error);
    throw new Error(`Failed to generate lesson: Invalid response format. Please try again.`);
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
  const { topic, gradeLevel = 3, userId } = req.body;
  const model = 'gemini-2.5-flash';
    
    if (!topic) {
      console.info('❌ Missing topic');
      logLessonCall({
        userId,
        gradeLevel,
        topic: topic || 'unknown',
        responseTimeMs: Date.now() - startTime,
        success: false,
        error: 'BadRequest',
        model,
      });
      await flushApiLogger();
      return res.status(400).json({ error: "Topic is required." });
    }

  try {
    console.info('📚 Lesson Generate API: Request received', req.body);
    
    // Get the configuration for this lesson
    const config = getLessonConfig(topic, gradeLevel);
    
    // Create the contents array with user input
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: `topic = ${topic}, grade ${gradeLevel}, age ${gradeLevel + 5}`,
          },
        ],
      },
    ];
    
    console.info('📚 Sending lesson request to Gemini for topic:', topic);
    const response = await ai.models.generateContent({
      model,
      config,
      contents,
    });
    
    console.info('📚 Gemini raw result received');
    const responseText = response.text || '';
    console.info('📚 Gemini response text:', responseText.substring(0, 200) + '...');
    // Debug: print token metadata
    console.debug('[LEARN API] Logging tokens:', {
      promptTokenCount: response.usageMetadata?.promptTokenCount,
      candidatesTokenCount: response.usageMetadata?.candidatesTokenCount,
      totalTokenCount: response.usageMetadata?.totalTokenCount,
      usageMetadata: response.usageMetadata
    });
    // Process complete response - this will throw if parsing fails
    const processedResponse = processLessonResponse(responseText, topic, gradeLevel);

    logLessonCall({
      userId,
      gradeLevel,
      topic,
      responseText,
      responseTimeMs: Date.now() - startTime,
      success: true,
      usageMetadata: response.usageMetadata,
      model,
    });
    await flushApiLogger();

    console.info('✅ Lesson Generate API: Responding with lesson for topic:', topic);
    
    return res.status(200).json(processedResponse);
  } catch (error: any) {
    console.error('❌ Lesson Generate API Error:', error);
    logLessonCall({
      userId,
      gradeLevel,
      topic,
      responseTimeMs: Date.now() - startTime,
      success: false,
      error: error.message || 'UnknownError',
      model,
    });
    await flushApiLogger();
    return res.status(500).json({ 
      error: 'An unexpected error occurred while generating the lesson.',
      topic: req.body?.topic
    });
  }
} 