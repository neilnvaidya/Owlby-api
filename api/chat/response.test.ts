// @jest-environment node
// eslint-disable-next-line @typescript-eslint/no-var-requires
// If @vercel/node types are not available in test env, you may need to mock or stub them for local testing.
import handler from './response';
// import { VercelRequest, VercelResponse } from '@vercel/node';

type VercelRequest = any;
type VercelResponse = any;

describe('POST /api/chat/response', () => {
  it('returns a response for a valid message and chatId', async () => {
    const req = {
      method: 'POST',
      body: { message: 'What is the capital of France?', chatId: 'test-chat-1' },
    } as VercelRequest;
    let statusCode = 0;
    let jsonData: any = null;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(data: any) { jsonData = data; return this; },
    } as unknown as VercelResponse;

    await handler(req, res);
    expect(statusCode).toBe(200);
    expect(jsonData).toHaveProperty('response');
    expect(typeof jsonData.response).toBe('string');
    expect(jsonData.chatId).toBe('test-chat-1');
  });

  it('returns 400 if message or chatId is missing', async () => {
    const req = { method: 'POST', body: { message: '' } } as VercelRequest;
    let statusCode = 0;
    let jsonData: any = null;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(data: any) { jsonData = data; return this; },
    } as unknown as VercelResponse;

    await handler(req, res);
    expect(statusCode).toBe(400);
    expect(jsonData).toHaveProperty('error');
  });

  it('returns 405 for non-POST requests', async () => {
    const req = { method: 'GET' } as VercelRequest;
    let statusCode = 0;
    let jsonData: any = null;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(data: any) { jsonData = data; return this; },
    } as unknown as VercelResponse;

    await handler(req, res);
    expect(statusCode).toBe(405);
    expect(jsonData).toHaveProperty('error');
  });
}); 