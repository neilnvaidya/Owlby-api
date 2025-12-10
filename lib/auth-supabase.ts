import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase auth is not fully configured (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing)');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function verifySupabaseToken(token: string) {
  if (!token) throw new Error('Missing token');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new Error('Authentication failed');
  }
  return data.user;
}

