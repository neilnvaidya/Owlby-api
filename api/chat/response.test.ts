// @jest-environment node
// eslint-disable-next-line @typescript-eslint/no-var-requires
// If @vercel/node types are not available in test env, you may need to mock or stub them for local testing.
import handler from './generate-response';
// import { VercelRequest, VercelResponse } from '@vercel/node';

type VercelRequest = any;
type VercelResponse = any;

// Need to make jest global to fix linter errors
declare const jest: any;
declare const describe: any;
declare const it: any;
declare const beforeEach: any;
declare const expect: any;

// Mock Gemini API to avoid actual API calls during tests
jest.mock('@google/genai', () => {
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => {
      return {
        models: {
          generateContent: jest.fn().mockResolvedValue({
            text: JSON.stringify({
              response_text: {
                main: "The capital of France is Paris. It's a beautiful city known for the Eiffel Tower.",
                follow_up: "Would you like to learn more about Paris or France?"
              },
              interactive_elements: {
                followup_buttons: [
                  { text: "Tell me more about Paris", prompt: "What are some famous landmarks in Paris?" },
                  { text: "Learn about France", prompt: "What is France known for?" }
                ],
                learn_more: {
                  prompt: "Explore more about France and its capital",
                  tags: ["geography", "europe", "cities", "france"]
                },
                story_button: {
                  title: "Story Time!",
                  story_prompt: "Tell me a story about someone visiting Paris"
                }
              },
              content_blocks: {
                safety_filter: false
              }
            })
          }),
        },
      };
    }),
    HarmBlockThreshold: {
      BLOCK_LOW_AND_ABOVE: 'BLOCK_LOW_AND_ABOVE',
    },
    HarmCategory: {
      HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
      HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
      HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT',
    },
    Type: {
      OBJECT: 'object',
      ARRAY: 'array',
      STRING: 'string',
      INTEGER: 'integer',
      BOOLEAN: 'boolean',
    },
  };
});

describe('POST /api/chat/generate-response', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an enhanced response for a valid message and chatId', async () => {
    const req = {
      method: 'POST',
      body: { message: 'What is the capital of France?', chatId: 'test-chat-1' },
      headers: {},
      setHeader: jest.fn()
    } as VercelRequest;
    
    let statusCode = 0;
    let jsonData: any = null;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(data: any) { jsonData = data; return this; },
      setHeader: jest.fn(),
      end: jest.fn()
    } as unknown as VercelResponse;

    await handler(req, res);
    
    expect(statusCode).toBe(200);
    expect(jsonData).toHaveProperty('response_text');
    expect(jsonData.response_text).toHaveProperty('main');
    expect(jsonData.response_text).toHaveProperty('follow_up');
    expect(jsonData).toHaveProperty('interactive_elements');
    expect(jsonData.interactive_elements).toHaveProperty('followup_buttons');
    expect(jsonData.interactive_elements).toHaveProperty('learn_more');
    expect(jsonData.interactive_elements).toHaveProperty('story_button');
    expect(jsonData).toHaveProperty('content_blocks');
    expect(jsonData.chatId).toBe('test-chat-1');
    expect(jsonData).toHaveProperty('gradeLevel');
    expect(jsonData).toHaveProperty('success');
    expect(jsonData.gradeLevel).toBe(3); // Default grade level
    expect(jsonData.success).toBe(true);
  });

  it('respects the provided grade level parameter', async () => {
    const req = {
      method: 'POST',
      body: { 
        message: 'What is the solar system?', 
        chatId: 'test-chat-2',
        gradeLevel: 5
      },
      headers: {},
      setHeader: jest.fn()
    } as VercelRequest;
    
    let statusCode = 0;
    let jsonData: any = null;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(data: any) { jsonData = data; return this; },
      setHeader: jest.fn(),
      end: jest.fn()
    } as unknown as VercelResponse;

    await handler(req, res);
    
    expect(statusCode).toBe(200);
    expect(jsonData.gradeLevel).toBe(5);
    expect(jsonData.chatId).toBe('test-chat-2');
  });

  it('includes interactive elements in the response', async () => {
    const req = {
      method: 'POST',
      body: { 
        message: 'Tell me about the solar system', 
        chatId: 'test-chat-3'
      },
      headers: {},
      setHeader: jest.fn()
    } as VercelRequest;
    
    let statusCode = 0;
    let jsonData: any = null;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(data: any) { jsonData = data; return this; },
      setHeader: jest.fn(),
      end: jest.fn()
    } as unknown as VercelResponse;

    await handler(req, res);
    
    expect(statusCode).toBe(200);
    expect(jsonData.interactive_elements.followup_buttons).toBeInstanceOf(Array);
    expect(jsonData.interactive_elements.followup_buttons.length).toBeGreaterThan(0);
    expect(jsonData.interactive_elements.learn_more).toHaveProperty('prompt');
    expect(jsonData.interactive_elements.learn_more).toHaveProperty('tags');
    expect(jsonData.interactive_elements.story_button).toHaveProperty('title');
    expect(jsonData.interactive_elements.story_button).toHaveProperty('story_prompt');
  });



  it('returns 400 if message or chatId is missing', async () => {
    const req = { 
      method: 'POST', 
      body: { message: '' },
      headers: {},
      setHeader: jest.fn()
    } as VercelRequest;
    
    let statusCode = 0;
    let jsonData: any = null;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(data: any) { jsonData = data; return this; },
      setHeader: jest.fn(),
      end: jest.fn()
    } as unknown as VercelResponse;

    await handler(req, res);
    
    expect(statusCode).toBe(400);
    expect(jsonData).toHaveProperty('error');
  });

  it('returns 405 for non-POST requests', async () => {
    const req = { 
      method: 'GET',
      headers: {},
      setHeader: jest.fn()
    } as VercelRequest;
    
    let statusCode = 0;
    let jsonData: any = null;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(data: any) { jsonData = data; return this; },
      setHeader: jest.fn(),
      end: jest.fn()
    } as unknown as VercelResponse;

    await handler(req, res);
    
    expect(statusCode).toBe(405);
    expect(jsonData).toHaveProperty('error');
  });

  it('handles OPTIONS requests for CORS', async () => {
    const req = { 
      method: 'OPTIONS',
      headers: {},
      setHeader: jest.fn()
    } as VercelRequest;
    
    let statusCode = 0;
    const res = {
      status(code: number) { statusCode = code; return this; },
      end: jest.fn(),
      setHeader: jest.fn(),
    } as unknown as VercelResponse;

    await handler(req, res);
    
    expect(statusCode).toBe(200);
    expect(res.end).toHaveBeenCalled();
  });
}); 