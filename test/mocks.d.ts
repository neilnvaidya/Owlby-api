import { SupabaseClient } from '@supabase/supabase-js';
import { Mock } from 'vitest';

// Add custom properties to the Supabase client for testing
declare module '@supabase/supabase-js' {
  interface SupabaseClient<Database, SchemaName, Schema> {
    select: Mock;
    eq: Mock;
    single: Mock;
    insert: Mock;
    update: Mock;
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
  status: Mock;
  json: Mock;
  send: Mock;
  setHeader: Mock;
  end: Mock;
}

export function mockRequest(): MockRequest;
export function mockResponse(): MockResponse; 