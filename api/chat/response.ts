import { GoogleGenerativeAI } from '@google/generative-ai';
import { VercelRequest, VercelResponse } from '@vercel/node';

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
  "If the question is sensitive, provide a general and age-appropriate answer with minimal words.";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, chatId } = req.body;
    if (!message || !chatId) {
      return res.status(400).json({ error: "Both 'message' and 'chatId' are required." });
    }

    let chatSession = chatSessions.get(chatId);
    if (!chatSession) {
      chatSession = model.startChat({ generationConfig });
      chatSessions.set(chatId, chatSession);
    }

    let responseText;
    try {
      const result = await chatSession.sendMessage(message);
      responseText = await result.response.text();
    } catch (aiError: any) {
      console.error('AI Error:', aiError);
      if (aiError.message && aiError.message.includes('User location is not supported')) {
        responseText =
          "I'm sorry, but I'm not available in your region at the moment. Is there anything else I can help you with?";
      } else {
        responseText =
          "I'm having trouble processing your request right now. Can you try asking something else?";
      }
    }

    return res.status(200).json({ response: responseText, chatId });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred while processing your request.' });
  }
} 