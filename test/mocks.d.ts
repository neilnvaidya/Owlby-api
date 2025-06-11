import { SupabaseClient } from '@supabase/supabase-js';
import { jest } from '@jest/globals';

// Add custom properties to the Supabase client for testing
declare module '@supabase/supabase-js' {
  interface SupabaseClient<Database, SchemaName, Schema> {
    select: jest.Mock;
    eq: jest.Mock;
    single: jest.Mock;
    insert: jest.Mock;
    update: jest.Mock;
  }
}

// Mock request and response types
export interface MockRequest {
  headers: { [key: string]: string };
  method: string;
  body: any;
  query: any;
}

export interface MockResponse {
  status: jest.Mock;
  json: jest.Mock;
  send: jest.Mock;
  setHeader: jest.Mock;
  end: jest.Mock;
}

export function mockRequest(): MockRequest;
export function mockResponse(): MockResponse; 