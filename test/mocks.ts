import { VercelRequest, VercelResponse } from '@vercel/node';
import { jest } from '@jest/globals';

export function mockRequest(overrides = {}): VercelRequest {
  return {
    headers: {},
    query: {},
    cookies: {},
    body: {},
    method: 'GET',
    url: '/',
    ...overrides,
  } as unknown as VercelRequest;
}

export function mockResponse(): VercelResponse {
  const res: any = {};
  
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  
  return res as unknown as VercelResponse;
} 