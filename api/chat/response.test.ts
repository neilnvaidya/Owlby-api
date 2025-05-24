// @jest-environment node
// eslint-disable-next-line @typescript-eslint/no-var-requires
// If @vercel/node types are not available in test env, you may need to mock or stub them for local testing.
import handler from './response';
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
jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => {
      return {
        getGenerativeModel: jest.fn().mockImplementation(() => {
          return {
            startChat: jest.fn().mockImplementation(() => {
              return {
                sendMessage: jest.fn().mockResolvedValue({
                  response: {
                    text: jest.fn().mockResolvedValue(
                      "The capital of France is Paris. It's a beautiful city known for the Eiffel Tower."
                    ),
                  },
                }),
              };
            }),
          };
        }),
      };
    }),
  };
});

describe('POST /api/chat/response', () => {
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
    } as unknown as VercelResponse;

    await handler(req, res);
    
    expect(statusCode).toBe(200);
    expect(jsonData).toHaveProperty('response');
    expect(typeof jsonData.response).toBe('string');
    expect(jsonData.chatId).toBe('test-chat-1');
    expect(jsonData).toHaveProperty('topic');
    expect(jsonData).toHaveProperty('gradeLevel');
    expect(jsonData).toHaveProperty('learnMoreAvailable');
    expect(jsonData.gradeLevel).toBe(3); // Default grade level
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
    } as unknown as VercelResponse;

    await handler(req, res);
    
    expect(statusCode).toBe(200);
    expect(jsonData.gradeLevel).toBe(5);
  });

  it('correctly identifies educational topics', async () => {
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
    } as unknown as VercelResponse;

    await handler(req, res);
    
    expect(statusCode).toBe(200);
    expect(jsonData.topic).toContain('solar system');
    expect(jsonData.learnMoreAvailable).toBe(true);
  });

  it('identifies non-educational topics', async () => {
    const req = {
      method: 'POST',
      body: { 
        message: 'How are you today?', 
        chatId: 'test-chat-4'
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
    } as unknown as VercelResponse;

    await handler(req, res);
    
    expect(statusCode).toBe(200);
    expect(jsonData.learnMoreAvailable).toBe(false);
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
    } as unknown as VercelResponse;

    await handler(req, res);
    
    expect(statusCode).toBe(405);
    expect(jsonData).toHaveProperty('error');
  });
}); 