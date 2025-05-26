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

/**
 * Fetch an image from Wikimedia Commons API
 * @param searchTerm The term to search for
 * @returns Promise<string | null> URL of the image or null if not found
 */
async function fetchWikimediaImage(searchTerm: string): Promise<string | null> {
  try {
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTerm)}&srnamespace=6&format=json&origin=*&srlimit=5`;
    
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    
    if (searchData.query?.search?.length > 0) {
      // Get the first result
      const firstResult = searchData.query.search[0];
      const fileName = firstResult.title.replace('File:', '');
      
      // Get the actual file URL
      const fileUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(fileName)}&prop=imageinfo&iiprop=url&format=json&origin=*`;
      
      const fileResponse = await fetch(fileUrl);
      const fileData = await fileResponse.json();
      
      const pages = fileData.query?.pages;
      if (pages) {
        const pageId = Object.keys(pages)[0];
        const imageUrl = pages[pageId]?.imageinfo?.[0]?.url;
        
        if (imageUrl) {
          console.log('📚 Found Wikimedia image:', imageUrl);
          return imageUrl;
        }
      }
    }
    
    console.log('📚 No suitable Wikimedia image found for:', searchTerm);
    return null;
  } catch (error) {
    console.error('📚 Error fetching Wikimedia image:', error);
    return null;
  }
}

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
            imageSuggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: {
                    type: Type.STRING,
                  },
                  searchQuery: {
                    type: Type.STRING,
                  },
                  safeSourceExample: {
                    type: Type.STRING,
                    description: "Example: 'Wikimedia Commons' URL when available",
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
6. **Images**: Suggest 2-3 safe image search queries with example sources

Technical considerations:
- Use <br> for line breaks
- **Bold** with double asterisks
- For images: Prefer Wikimedia URLs when possible
- If no relevant images, omit "imageSuggestions"

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
      // Transform the new format to the legacy format for backward compatibility
      const lesson = jsonResponse.lesson;
      return {
        success: true,
        lesson_title: lesson.title,
        grade_level: gradeLevel,
        topic: topic,
        introduction: {
          hook: lesson.introduction.split('\\n')[0] || lesson.introduction,
          overview: lesson.introduction.split('\\n').slice(1).join(' ') || "Let's explore this fascinating topic together!"
        },
        main_content: lesson.keyPoints.map((point: string, index: number) => ({
          section_title: `Key Point ${index + 1}`,
          content: point,
          key_takeaway: point.replace(/\*\*(.*?)\*\*/g, '$1')
        })),
        fun_facts: lesson.keywords.slice(0, 3).map((kw: any) => `**${kw.term}**: ${kw.definition}`),
        interactive_elements: {
          questions: lesson.quickQuiz.map((q: any) => q.question),
          activities: [
            "Draw a picture of what you learned today!",
            "Try exploring this topic with a friend or family member!",
            "Think of three questions you'd like to ask about this topic!"
          ]
        },
        conclusion: {
          summary: `We've learned so many interesting things about ${topic}!`,
          encouragement: "Keep asking questions and exploring the world around you!",
          next_steps: "What other topics would you like to explore next?"
        },
        vocabulary: lesson.keywords,
        additional_resources: {
          books: ["Ask your librarian for books about this topic!"],
          websites: ["Talk to a grown-up about finding safe websites to learn more!"],
          activities: ["Keep exploring and asking questions!"]
        },
        // Include the new format data as well
        newFormat: {
          lesson: lesson
        }
      };
    } else {
      throw new Error('Invalid lesson JSON structure');
    }
  } catch (error) {
    console.warn('Failed to parse lesson JSON response, falling back to plain text:', error);
    
    // Create a fallback lesson structure
    return {
      success: false,
      lesson_title: "Learning Adventure",
      grade_level: gradeLevel,
      topic: topic,
      introduction: {
        hook: "Hoot hoot! Let's explore something amazing together!",
        overview: "We're going to discover new and exciting things!"
      },
      main_content: [
        {
          section_title: "What We're Learning",
          content: responseText,
          key_takeaway: "Learning is always an adventure!"
        }
      ],
      fun_facts: [
        "Learning new things helps your brain grow stronger!",
        "Every question you ask makes you smarter!",
        "Curiosity is one of the most powerful tools for learning!"
      ],
      interactive_elements: {
        questions: [
          "What would you like to learn more about?",
          "How does this connect to things you already know?",
          "What questions do you have about this topic?"
        ],
        activities: [
          "Try exploring this topic with a friend or family member!",
          "Draw a picture of what you learned today!",
          "Think of three questions you'd like to ask about this topic!"
        ]
      },
      conclusion: {
        summary: "We've learned so many interesting things today!",
        encouragement: "Keep asking questions and exploring the world around you!",
        next_steps: "What other topics would you like to explore next?"
      },
      vocabulary: [
        {
          term: "Learning",
          definition: "The process of gaining new knowledge or skills"
        }
      ],
      additional_resources: {
        books: ["Ask your librarian for books about this topic!"],
        websites: ["Talk to a grown-up about finding safe websites to learn more!"],
        activities: ["Keep exploring and asking questions!"]
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
    console.log('📚 Lesson Generate API: Request received', req.body);
    const { topic, gradeLevel = 3 } = req.body;
    
    if (!topic) {
      console.log('❌ Missing topic');
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
      lesson_title: "Learning Adventure",
      grade_level: gradeLevel,
      topic: topic,
      introduction: {
        hook: "Hoot hoot! Let's explore something amazing together!",
        overview: "We're going to discover new and exciting things!"
      },
      main_content: [
        {
          section_title: "What We're Learning",
          content: "Let's dive into this fascinating topic!",
          key_takeaway: "Learning is always an adventure!"
        }
      ],
      fun_facts: [
        "Learning new things helps your brain grow stronger!",
        "Every question you ask makes you smarter!",
        "Curiosity is one of the most powerful tools for learning!"
      ],
      interactive_elements: {
        questions: [
          "What would you like to learn more about?",
          "How does this connect to things you already know?",
          "What questions do you have about this topic?"
        ],
        activities: [
          "Try exploring this topic with a friend or family member!",
          "Draw a picture of what you learned today!",
          "Think of three questions you'd like to ask about this topic!"
        ]
      },
      conclusion: {
        summary: "We've learned so many interesting things today!",
        encouragement: "Keep asking questions and exploring the world around you!",
        next_steps: "What other topics would you like to explore next?"
      },
      vocabulary: [
        {
          term: "Learning",
          definition: "The process of gaining new knowledge or skills"
        }
      ],
      additional_resources: {
        books: ["Ask your librarian for books about this topic!"],
        websites: ["Talk to a grown-up about finding safe websites to learn more!"],
        activities: ["Keep exploring and asking questions!"]
      },
      success: false
    };
    
    try {
      console.log('📚 Sending lesson request to Gemini for topic:', topic);
      const response = await ai.models.generateContent({
        model,
        config,
        contents,
      });
      
      console.log('📚 Gemini raw result received');
      const responseText = response.text || '';
      console.log('📚 Gemini response text:', responseText.substring(0, 200) + '...');
      
      // Process complete response
      processedResponse = processLessonResponse(responseText, topic, gradeLevel);
      
      // Try to fetch a Wikimedia image for the topic
      try {
        const imageUrl = await fetchWikimediaImage(topic);
        if (imageUrl) {
          processedResponse.image_url = imageUrl;
        }
      } catch (imageError) {
        console.log('📚 Could not fetch image for topic:', topic, imageError);
      }
      
      processedResponse.success = true;
      
    } catch (aiError: any) {
      console.error('❌ AI Error:', aiError);
      if (aiError.message && aiError.message.includes('User location is not supported')) {
        processedResponse.introduction.hook =
          "Hoot hoot! I'm sorry, but I'm not available in your region at the moment. Let's try learning about this topic in a different way!";
      } else {
        processedResponse.introduction.hook =
          "Hoo-hoo! I'm having trouble creating this lesson right now. Let's try a different approach to learning about this topic!";
      }
    }

    console.log('✅ Lesson Generate API: Responding with success:', processedResponse.success);
    
    return res.status(200).json(processedResponse);
  } catch (error) {
    console.error('❌ Lesson Generate API Error:', error);
    return res.status(500).json({ 
      error: 'An unexpected error occurred while generating the lesson.',
      topic: req.body?.topic,
      success: false
    });
  }
} 