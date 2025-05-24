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

// Base instructions template with placeholders for grade level and age
const instructionsTemplate =
  "Answer the following question as if teaching a child in grade {gradeLevel} (around {ageYears} years old).\n" +
  "Provide educational, informative responses that are:\n" +
  "- Clear and easy to understand for the specified grade level\n" +
  "- Structured with short paragraphs and/or bullet points for key facts\n" +
  "- Comprehensive enough to teach the concept, but not overwhelming\n" +
  "- Engaging and interesting to maintain a child's attention\n\n" +
  
  "For scientific, historical, or factual topics:\n" +
  "- Include 3-5 key points that are grade-appropriate\n" +
  "- Use simple analogies where helpful\n" +
  "- Avoid technical jargon unless you explain it\n\n" +
  
  "When the question could benefit from a visual explanation (like scientific concepts, math problems, or processes), " +
  "create a simple SVG diagram. Follow these requirements for diagrams:\n" +
  "1. Create an educational SVG diagram that helps explain the concept visually\n" +
  "2. Keep SVGs simple, clean, and suitable for educational purposes\n" +
  "3. Use appropriate colors, shapes, and labels in the diagram\n" +
  "4. Output the SVG code between <SVG_DIAGRAM> and </SVG_DIAGRAM> tags\n" +
  "5. Add a short title for the diagram between <SVG_TITLE> and </SVG_TITLE> tags\n" +
  "6. Include a brief description between <SVG_DESCRIPTION> and </SVG_DESCRIPTION> tags";

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
 * Process the response text to extract SVG diagram if present
 * @param responseText The raw response from Gemini
 * @returns Processed response with extracted SVG data
 */
function processSvgResponse(responseText: string) {
  const result = {
    text: responseText,
    diagram: null as null | {
      svg: string;
      title: string;
      description: string;
    },
  };

  // Extract SVG diagram if present
  const svgMatch = responseText.match(/<SVG_DIAGRAM>([\s\S]*?)<\/SVG_DIAGRAM>/);
  const titleMatch = responseText.match(/<SVG_TITLE>([\s\S]*?)<\/SVG_TITLE>/);
  const descMatch = responseText.match(/<SVG_DESCRIPTION>([\s\S]*?)<\/SVG_DESCRIPTION>/);

  // If we have an SVG diagram, extract and sanitize it
  if (svgMatch && titleMatch && descMatch) {
    const rawSvg = svgMatch[1].trim();
    const title = titleMatch[1].trim();
    const description = descMatch[1].trim();

    // Basic sanitization (should be enhanced with proper SVG sanitization library)
    const sanitizedSvg = sanitizeSvg(rawSvg);

    result.diagram = {
      svg: sanitizedSvg,
      title,
      description,
    };

    // Remove the SVG tags from the text response
    result.text = responseText
      .replace(/<SVG_DIAGRAM>[\s\S]*?<\/SVG_DIAGRAM>/g, '')
      .replace(/<SVG_TITLE>[\s\S]*?<\/SVG_TITLE>/g, '')
      .replace(/<SVG_DESCRIPTION>[\s\S]*?<\/SVG_DESCRIPTION>/g, '')
      .trim();
  }

  return result;
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

/**
 * Extract the main educational topic from the query and response
 * Simple implementation that will be enhanced in future versions
 */
function extractMainTopic(query: string, response: string): string {
  // For MVP, use the first few words of the query as the topic
  // This will be enhanced with NLP in the future
  const words = query.split(' ');
  if (words.length <= 3) {
    return query.trim();
  }
  
  // Try to extract a meaningful phrase (first 3-5 words)
  return words.slice(0, Math.min(5, words.length)).join(' ').trim();
}

/**
 * Determine if a topic is educational and would benefit from a lesson
 */
function isEducationalTopic(topic: string): boolean {
  const educationalKeywords = [
    'science', 'math', 'history', 'geography', 'biology',
    'physics', 'chemistry', 'planet', 'animal', 'plant',
    'country', 'human', 'body', 'art', 'music', 'language',
    'space', 'dinosaur', 'earth', 'ocean', 'environment',
    'weather', 'solar', 'atom', 'cell', 'molecule', 'computer',
    'technology', 'machine', 'energy', 'force', 'gravity',
    'ecosystem', 'climate', 'culture', 'civilization', 'world'
  ];
  
  const topicLower = topic.toLowerCase();
  return educationalKeywords.some(keyword => topicLower.includes(keyword));
}

/**
 * Process the full response to create the enhanced response object
 */
function processResponse(responseText: string, query: string, gradeLevel: number, chatId: string) {
  // Process SVG as before
  const processedSvg = processSvgResponse(responseText);
  
  // Extract main topic
  const topic = extractMainTopic(query, processedSvg.text);
  
  // Determine if learn more would be appropriate
  const learnMoreAvailable = isEducationalTopic(topic);
  
  return {
    response: processedSvg.text,
    chatId,
    diagram: processedSvg.diagram,
    topic,
    gradeLevel,
    learnMoreAvailable
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
    let processedResponse: {
      response: string;
      chatId: string;
      diagram: null | {
        svg: string;
        title: string;
        description: string;
      };
      topic: string;
      gradeLevel: number;
      learnMoreAvailable: boolean;
    } = {
      response: '',
      chatId,
      diagram: null,
      topic: '',
      gradeLevel,
      learnMoreAvailable: false
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
        processedResponse.response =
          "I'm sorry, but I'm not available in your region at the moment. Is there anything else I can help you with?";
      } else {
        processedResponse.response =
          "I'm having trouble processing your request right now. Can you try asking something else?";
      }
    }

    console.log('API: Responding with', { 
      response: processedResponse.response.substring(0, 100) + '...',
      chatId,
      topic: processedResponse.topic,
      gradeLevel: processedResponse.gradeLevel,
      learnMoreAvailable: processedResponse.learnMoreAvailable,
      diagram: processedResponse.diagram ? 'SVG included' : 'No SVG' 
    });
    
    return res.status(200).json(processedResponse);
  } catch (error) {
    console.error('API: API Error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred while processing your request.' });
  }
} 