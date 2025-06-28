import { config } from 'dotenv';
import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  Type,
} from '@google/genai';

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
          required: ["title", "introduction", "keyPoints", "keywords", "quickQuiz"],
          properties: {
            title: {
              type: Type.STRING,
            },
            introduction: {
              type: Type.STRING,
              description: "2-3 sentences with line breaks (\\n) for readability",
            },
            keyPoints: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING,
                description: "Bullet points using **bold** for key terms",
              },
            },
            keywords: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["term", "definition"],
                properties: {
                  term: {
                    type: Type.STRING,
                  },
                  definition: {
                    type: Type.STRING,
                  },
                },
              },
            },
            quickQuiz: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["question", "options", "correctAnswerIndex"],
                properties: {
                  question: {
                    type: Type.STRING,
                  },
                  options: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.STRING,
                    },
                  },
                  correctAnswerIndex: {
                    type: Type.INTEGER,
                  },
                },
              },
            },
            extendedQuiz: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["question", "options", "correctAnswerIndex", "explanation"],
                properties: {
                  question: {
                    type: Type.STRING,
                  },
                  options: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.STRING,
                    },
                  },
                  correctAnswerIndex: {
                    type: Type.INTEGER,
                  },
                  explanation: {
                    type: Type.STRING,
                  },
                },
              },
            },

          },
        },
      },
    },
    systemInstruction: [
      {
        text: `Create a lesson about "${topic}" for grade ${gradeLevel} (${ageYears} years old). 

Structure response as JSON matching the schema. 

Requirements:
1. **Title**: <50 chars, catchy
2. **Introduction**: 2-3 sentences with \\n breaks
3. **Key Points**: 3-5 items using **bold** terms
4. **Keywords**: Simple definitions
5. **Quizzes**: 
   - Quick: 3 basic MCQs
   - Extended: 2 challenging MCQs with explanations

Technical considerations:
- Use <br> for line breaks
- **Bold** with double asterisks

You are Owlby, a wise and playful owl teacher. Use "Hoot hoot!" expressions and maintain your friendly, encouraging personality throughout the lesson.`,
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
        keyPoints: lesson.keyPoints || [],
        keywords: lesson.keywords || [],
        quickQuiz: {
          questions: lesson.quickQuiz || []
        },
        extendedQuiz: {
          questions: lesson.extendedQuiz || []
        }
      };
    } else {
      throw new Error('Invalid lesson JSON structure');
    }
  } catch (error) {
    console.warn('Failed to parse lesson JSON response, falling back to plain text:', error);
    
    // Create a fallback lesson structure that matches the app's Lesson type
    return {
      topic: topic,
      gradeLevel: gradeLevel,
      title: "Learning Adventure",
      introduction: "Hoot hoot! Let's explore something amazing together!\n\nWe're going to discover new and exciting things!",
      keyPoints: [
        "Learning new things helps your brain grow stronger!",
        "Every question you ask makes you smarter!",
        "Curiosity is one of the most powerful tools for learning!"
      ],
      keywords: [
        {
          term: "Learning",
          definition: "The process of gaining new knowledge or skills"
        },
        {
          term: "Curiosity",
          definition: "Being interested in learning about the world around you"
        }
      ],
      quickQuiz: {
        questions: [
          {
            question: "What helps your brain grow stronger?",
            options: ["Learning new things", "Staying the same", "Not asking questions", "Being bored"],
            correctAnswerIndex: 0
          },
          {
            question: "What is curiosity?",
            options: ["Being scared", "Being interested in learning", "Not caring", "Sleeping"],
            correctAnswerIndex: 1
          }
        ]
      },
      extendedQuiz: {
        questions: [
          {
            question: "Why is asking questions important for learning?",
            options: ["It's not important", "It helps us understand better", "It confuses us", "It wastes time"],
            correctAnswerIndex: 1,
            explanation: "Asking questions helps us think deeper and understand topics better!"
          }
        ]
      }
    };
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

  try {
    console.info('📚 Lesson Generate API: Request received', req.body);
    const { topic, gradeLevel = 3 } = req.body;
    
    if (!topic) {
      console.info('❌ Missing topic');
      return res.status(400).json({ error: "Topic is required." });
    }
    
    // Get the configuration for this lesson
    const config = getLessonConfig(topic, gradeLevel);
    const model = 'gemini-2.0-flash-exp';
    
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

    let processedResponse: any = {
      topic: topic,
      gradeLevel: gradeLevel,
      title: "Learning Adventure",
      introduction: "Hoot hoot! Let's explore something amazing together!\n\nWe're going to discover new and exciting things!",
      keyPoints: [
        "Learning new things helps your brain grow stronger!",
        "Every question you ask makes you smarter!",
        "Curiosity is one of the most powerful tools for learning!"
      ],
      keywords: [
        {
          term: "Learning",
          definition: "The process of gaining new knowledge or skills"
        }
      ],
      quickQuiz: {
        questions: [
          {
            question: "What helps your brain grow stronger?",
            options: ["Learning new things", "Staying the same", "Not asking questions", "Being bored"],
            correctAnswerIndex: 0
          }
        ]
      },
      extendedQuiz: {
        questions: [
          {
            question: "Why is asking questions important for learning?",
            options: ["It's not important", "It helps us understand better", "It confuses us", "It wastes time"],
            correctAnswerIndex: 1,
            explanation: "Asking questions helps us think deeper and understand topics better!"
          }
        ]
      }
    };
    
    try {
      console.info('📚 Sending lesson request to Gemini for topic:', topic);
      const response = await ai.models.generateContent({
        model,
        config,
        contents,
      });
      
      console.info('📚 Gemini raw result received');
      const responseText = response.text || '';
      console.info('📚 Gemini response text:', responseText.substring(0, 200) + '...');
      
      // Process complete response
      processedResponse = processLessonResponse(responseText, topic, gradeLevel);
      
    } catch (aiError: any) {
      console.error('❌ AI Error:', aiError);
      if (aiError.message && aiError.message.includes('User location is not supported')) {
        processedResponse.introduction =
          "Hoot hoot! I'm sorry, but I'm not available in your region at the moment. Let's try learning about this topic in a different way!";
      } else {
        processedResponse.introduction =
          "Hoo-hoo! I'm having trouble creating this lesson right now. Let's try a different approach to learning about this topic!";
      }
    }

    console.info('✅ Lesson Generate API: Responding with lesson for topic:', topic);
    
    return res.status(200).json(processedResponse);
  } catch (error) {
    console.error('❌ Lesson Generate API Error:', error);
    return res.status(500).json({ 
      error: 'An unexpected error occurred while generating the lesson.',
      topic: req.body?.topic
    });
  }
} 