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
const instructions =
  "Answer the following question directly and concisely, as if speaking to a 10-year-old child.\n" +
  "Use only the most necessary words to answer the question accurately.\n" +
  "Avoid any extra explanations or information beyond the direct answer.\n" +
  "Keep the language simple and easy for a child to understand.\n" +
  "If the question is sensitive, provide a general and age-appropriate answer with minimal words.\n\n" +
  "When the question could benefit from a visual explanation (like scientific concepts, math problems, or processes), " +
  "create a simple SVG diagram. Follow these requirements for diagrams:\n" +
  "1. Create an educational SVG diagram that helps explain the concept visually\n" +
  "2. Keep SVGs simple, clean, and suitable for educational purposes\n" +
  "3. Use appropriate colors, shapes, and labels in the diagram\n" +
  "4. Output the SVG code between <SVG_DIAGRAM> and </SVG_DIAGRAM> tags\n" +
  "5. Add a short title for the diagram between <SVG_TITLE> and </SVG_TITLE> tags\n" +
  "6. Include a brief description between <SVG_DESCRIPTION> and </SVG_DESCRIPTION> tags";

const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
  systemInstruction: instructions,
});

const generationConfig = {
  temperature: 1,
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

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://www.owlby.com'); // Or specify your frontend domain for more security
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
    const { message, chatId } = req.body;
    if (!message || !chatId) {
      console.log('API: Missing message or chatId');
      return res.status(400).json({ error: "Both 'message' and 'chatId' are required." });
    }

    let chatSession = chatSessions.get(chatId);
    if (!chatSession) {
      chatSession = model.startChat({ generationConfig });
      chatSessions.set(chatId, chatSession);
    }

    let responseText;
    let processedResponse: {
      text: string;
      diagram: null | {
        svg: string;
        title: string;
        description: string;
      }
    } = { text: '', diagram: null };
    
    try {
      console.log('API: Sending message to Gemini', message);
      const result = await chatSession.sendMessage(message);
      console.log('API: Gemini raw result', result);
      responseText = await result.response.text();
      console.log('API: Gemini response text', responseText);
      
      // Process response to extract SVG if present
      processedResponse = processSvgResponse(responseText);
    } catch (aiError: any) {
      console.error('API: AI Error:', aiError);
      if (aiError.message && aiError.message.includes('User location is not supported')) {
        processedResponse.text =
          "I'm sorry, but I'm not available in your region at the moment. Is there anything else I can help you with?";
      } else {
        processedResponse.text =
          "I'm having trouble processing your request right now. Can you try asking something else?";
      }
    }

    console.log('API: Responding with', { 
      response: processedResponse.text, 
      chatId,
      diagram: processedResponse.diagram ? 'SVG included' : 'No SVG' 
    });
    
    return res.status(200).json({
      response: processedResponse.text,
      chatId,
      diagram: processedResponse.diagram
    });
  } catch (error) {
    console.error('API: API Error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred while processing your request.' });
  }
} 