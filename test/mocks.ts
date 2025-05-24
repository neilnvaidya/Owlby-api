import { VercelRequest, VercelResponse } from '@vercel/node';
import { vi } from 'vitest';

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
  
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  res.end = vi.fn().mockReturnValue(res);
  
  return res as unknown as VercelResponse;
} 