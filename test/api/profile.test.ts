// @jest-environment node
import { describe, expect, jest, test, beforeEach } from '@jest/globals';
import { mockRequest, mockResponse } from '../mocks';
import handler from '../../api/profile';
import { verifyToken } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

// Mock auth and supabase
jest.mock('../../lib/auth', () => ({
  verifyToken: jest.fn(),
}));

// Mock the entire supabase module with proper query builder pattern
jest.mock('../../lib/supabase', () => {
  const mockQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };
  
  return {
    supabase: {
      from: jest.fn(() => mockQuery),
    },
  };
});

describe('Profile API', () => {
  let req: any;
  let res: any;
  let mockQuery: any;
  
  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    jest.resetAllMocks();
    
    // Get the mock query object for direct access
    mockQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };
    
    // Mock supabase.from to return our mock query
    (supabase.from as any) = jest.fn(() => mockQuery);
    
    // Default mock for token verification
    (verifyToken as any).mockResolvedValue({
      sub: 'auth0|123456',
      name: 'Test User',
      email: 'test@example.com',
      picture: 'https://example.com/pic.jpg',
    });
  });
  
  test('GET: should return 401 if no token is provided', async () => {
    req.headers.authorization = '';
    req.method = 'GET';
    
    await handler(req, res);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing or invalid token' });
  });
  
  test('GET: should return user profile if token is valid', async () => {
    req.headers.authorization = 'Bearer valid-token';
    req.method = 'GET';
    
    // Mock Supabase response - user exists
    const mockUser = {
      auth0_id: 'auth0|123456',
      name: 'Database User',
      email: 'test@example.com',
      avatar_url: 'https://example.com/db-pic.jpg',
      grade_level: 3,
      interests: ['space', 'math'],
      parent_email: 'parent@example.com',
    };
    
    // Mock the query chain
    mockQuery.single.mockResolvedValue({
      data: mockUser,
      error: null,
    });
    
    await handler(req, res);
    
    expect(verifyToken).toHaveBeenCalledWith('valid-token');
    expect(supabase.from).toHaveBeenCalledWith('users');
    expect(mockQuery.select).toHaveBeenCalledWith('*');
    expect(mockQuery.eq).toHaveBeenCalledWith('auth0_id', 'auth0|123456');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      user_id: 'auth0|123456',
      name: 'Database User',
      email: 'test@example.com',
      picture: 'https://example.com/db-pic.jpg',
      grade_level: 3,
      interests: ['space', 'math'],
      parent_email: 'parent@example.com',
    });
  });
  
  test('GET: should create user if not found', async () => {
    req.headers.authorization = 'Bearer valid-token';
    req.method = 'GET';
    
    // Mock Supabase response chains for better TypeScript compatibility
    // First call - user not found
    mockQuery.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116' },
    });
    
    // Second call - insert succeeds
    mockQuery.single.mockResolvedValueOnce({
      data: {
        auth0_id: 'auth0|123456',
        name: 'Test User',
        email: 'test@example.com',
        avatar_url: 'https://example.com/pic.jpg',
      },
      error: null,
    });
    
    await handler(req, res);
    
    expect(supabase.from).toHaveBeenCalledWith('users');
    expect(mockQuery.insert).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
  
  test('POST: should update user profile', async () => {
    req.headers.authorization = 'Bearer valid-token';
    req.method = 'POST';
    req.body = {
      name: 'Updated Name',
      grade_level: 4,
      interests: ['coding', 'music'],
      parent_email: 'new-parent@example.com',
    };
    
    // Mock Supabase response chain for the check if user exists
    mockQuery.single.mockResolvedValueOnce({
      data: { auth0_id: 'auth0|123456', name: 'Old Name' },
      error: null,
    });
    
    // Mock Supabase response chain for the update operation
    mockQuery.single.mockResolvedValueOnce({
      data: {
        auth0_id: 'auth0|123456',
        name: 'Updated Name',
        email: 'test@example.com',
        avatar_url: 'https://example.com/pic.jpg',
        grade_level: 4,
        interests: ['coding', 'music'],
        parent_email: 'new-parent@example.com',
      },
      error: null,
    });
    
    await handler(req, res);
    
    expect(supabase.from).toHaveBeenCalledWith('users');
    expect(mockQuery.update).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Updated Name',
      grade_level: 4,
      interests: ['coding', 'music'],
    }));
  });
  
  test('Should return 405 for unsupported methods', async () => {
    req.headers.authorization = 'Bearer valid-token';
    req.method = 'DELETE';
    
    await handler(req, res);
    
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
  });
}); 