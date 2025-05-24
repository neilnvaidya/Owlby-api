require('dotenv').config();
// @ts-ignore: Vercel provides types at runtime, and @types/vercel__node is not available
// <reference types="node" />
import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  LessonRequestBody, 
  Lesson,
  DiagramData
} from './lesson.types';

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-pro',
});

const generationConfig = {
  temperature: 0.7,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
};

/**
 * Creates a prompt for lesson generation based on topic and grade level
 */
function createLessonPrompt(topic: string, gradeLevel: number): string {
  const ageYears = gradeLevel + 5; // Rough approximation
  
  return `
  Create an educational lesson about "${topic}" for a child in grade ${gradeLevel} (around ${ageYears} years old).
  
  The lesson should be structured in JSON format with the following sections:
  
  1. A brief "title" for the lesson (max 50 characters)
  2. An engaging "introduction" paragraph (2-3 sentences)
  3. An array of "keyPoints" (3-5 bullet points explaining the main concepts)
  4. An array of "keywords" with:
     - "term": The keyword or phrase
     - "definition": A simple, grade-appropriate definition (1-2 sentences)
  5. A "quickQuiz" with 3 multiple choice questions, each containing:
     - "question": The question text
     - "options": An array of 4 possible answers
     - "correctAnswerIndex": The zero-based index of the correct answer
  6. An "extendedQuiz" with 2 more challenging questions, each containing:
     - "question": The question text
     - "options": An array of 4 possible answers
     - "correctAnswerIndex": The zero-based index of the correct answer
     - "explanation": A brief explanation of why the answer is correct
  
  Additionally, create an educational SVG diagram that helps visualize a key concept from the lesson:
  1. Create the SVG code between <SVG_DIAGRAM> and </SVG_DIAGRAM> tags
  2. Add a short title for the diagram between <SVG_TITLE> and </SVG_TITLE> tags
  3. Include a brief description between <SVG_DESCRIPTION> and </SVG_DESCRIPTION> tags
  
  Make sure all content is:
  - Age-appropriate for grade ${gradeLevel}
  - Educational and factually accurate
  - Clear and engaging for children
  - Free of complex terminology (unless explained)
  
  The JSON structure should be enclosed between <LESSON_JSON> and </LESSON_JSON> tags.
  `;
}

/**
 * Process the lesson response to extract JSON and SVG content
 */
function processLessonResponse(responseText: string, fallbackTopic: string, gradeLevel: number): Lesson {
  // Extract lesson JSON
  const lessonJsonMatch = responseText.match(/<LESSON_JSON>([\s\S]*?)<\/LESSON_JSON>/);
  
  // Default lesson in case parsing fails
  let lesson: Partial<Lesson> = {
    topic: fallbackTopic,
    gradeLevel: gradeLevel,
    title: `Learn about ${fallbackTopic}`,
    introduction: "Sorry, we couldn't generate a full lesson at this time.",
    keyPoints: ["Key point 1", "Key point 2", "Key point 3"],
    keywords: [],
    quickQuiz: { questions: [] },
    extendedQuiz: { questions: [] },
    diagram: null
  };
  
  if (lessonJsonMatch && lessonJsonMatch[1]) {
    try {
      const parsedLesson = JSON.parse(lessonJsonMatch[1].trim());
      lesson = { ...lesson, ...parsedLesson };
    } catch (e) {
      console.error('Error parsing lesson JSON:', e);
    }
  }
  
  // Extract SVG diagram if present
  const svgMatch = responseText.match(/<SVG_DIAGRAM>([\s\S]*?)<\/SVG_DIAGRAM>/);
  const titleMatch = responseText.match(/<SVG_TITLE>([\s\S]*?)<\/SVG_TITLE>/);
  const descMatch = responseText.match(/<SVG_DESCRIPTION>([\s\S]*?)<\/SVG_DESCRIPTION>/);

  if (svgMatch && titleMatch && descMatch) {
    const rawSvg = svgMatch[1].trim();
    const title = titleMatch[1].trim();
    const description = descMatch[1].trim();

    // Sanitize the SVG
    const sanitizedSvg = sanitizeSvg(rawSvg);

    lesson.diagram = {
      svg: sanitizedSvg,
      title,
      description,
    };
  }
  
  return lesson as Lesson;
}

/**
 * Basic SVG sanitization function
 * This is a placeholder - in a production app you would use a proper SVG sanitization library
 */
function sanitizeSvg(svg: string): string {
  // Simple sanitization - ensure it has valid SVG tags
  if (!svg.includes('<svg') || !svg.includes('</svg>')) {
    // If not a valid SVG, return an empty SVG
    return '<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg"><text x="10" y="20" fill="red">Invalid SVG</text></svg>';
  }

  // More comprehensive sanitization would be implemented here
  // This would remove potentially dangerous elements and attributes

  return svg;
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
    const { topic, gradeLevel = 3 } = req.body as LessonRequestBody;
    
    if (!topic) {
      return res.status(400).json({ error: "The 'topic' field is required." });
    }

    // Create the lesson prompt with grade level and topic
    const prompt = createLessonPrompt(topic, gradeLevel);

    // Generate lesson content using Gemini
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    });

    const responseText = await result.response.text();
    
    // Process the response to extract lesson JSON and SVG
    const processedResponse = processLessonResponse(responseText, topic, gradeLevel);

    return res.status(200).json(processedResponse);
  } catch (error) {
    console.error('API: Lesson generation error:', error);
    return res.status(500).json({ 
      error: 'An error occurred while generating the lesson content.'
    });
  }
} 