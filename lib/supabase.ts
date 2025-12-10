import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with environment variables
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Check if required environment variables are set
if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase environment variables are missing or empty');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);

// Define database schema types
export type User = {
  id: number;
  auth_uid: string;
  name: string;
  email: string;
  avatar_url: string | null;
  grade_level: number | null;
  interests: string[] | null;
  achievements: string[] | null;
  parent_email: string | null;
  created_at: string;
  updated_at: string | null;
}; 