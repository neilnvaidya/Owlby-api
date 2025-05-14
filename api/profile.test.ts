// @jest-environment node
import handler from './profile';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as jwt from 'jsonwebtoken';

jest.mock('jsonwebtoken');

const mockProfile = {
  sub: 'auth0|123',
  name: 'Test User',
  email: 'test@example.com',
  picture: 'https://example.com/avatar.png',
};

describe('GET /api/profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns profile for valid token', async () => {
    (jwt.verify as jest.Mock).mockImplementation((token, getKey, options, cb) => {
      cb(null, mockProfile);
    });
    const req = { method: 'GET', headers: { authorization: 'Bearer validtoken' } } as VercelRequest;
    let statusCode = 0;
    let jsonData: any = null;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(data: any) { jsonData = data; return this; },
    } as unknown as VercelResponse;
    await handler(req, res);
    expect(statusCode).toBe(200);
    expect(jsonData).toEqual({
      user_id: 'auth0|123',
      name: 'Test User',
      email: 'test@example.com',
      picture: 'https://example.com/avatar.png',
    });
  });

  it('returns 401 for missing token', async () => {
    const req = { method: 'GET', headers: {} } as VercelRequest;
    let statusCode = 0;
    let jsonData: any = null;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(data: any) { jsonData = data; return this; },
    } as unknown as VercelResponse;
    await handler(req, res);
    expect(statusCode).toBe(401);
    expect(jsonData).toHaveProperty('error');
  });

  it('returns 401 for invalid token', async () => {
    (jwt.verify as jest.Mock).mockImplementation((token, getKey, options, cb) => {
      cb(new Error('Invalid token'), null);
    });
    const req = { method: 'GET', headers: { authorization: 'Bearer invalidtoken' } } as VercelRequest;
    let statusCode = 0;
    let jsonData: any = null;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(data: any) { jsonData = data; return this; },
    } as unknown as VercelResponse;
    await handler(req, res);
    expect(statusCode).toBe(401);
    expect(jsonData).toHaveProperty('error');
  });

  it('returns 405 for non-GET methods', async () => {
    const req = { method: 'POST', headers: {} } as VercelRequest;
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