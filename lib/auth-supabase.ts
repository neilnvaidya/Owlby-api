import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase auth is not fully configured (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing)');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const AUTH_VERIFY_TIMEOUT_MS = Number(process.env.AUTH_VERIFY_TIMEOUT_MS ?? 5000);
const AUTH_CACHE_TTL_MS = Number(process.env.AUTH_CACHE_TTL_MS ?? 5 * 60 * 1000);
const authCache = new Map<string, { user: any; expiresAt: number }>();

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  return new Promise<T>((resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    promise.then(resolve).catch(reject);
  }).finally(() => clearTimeout(timeoutId));
}

export async function verifySupabaseToken(token: string) {
  if (!token) throw new Error('Missing token');
  const cached = authCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }
  if (cached && cached.expiresAt <= Date.now()) {
    authCache.delete(token);
  }

  const { data, error } = await withTimeout(
    supabase.auth.getUser(token),
    AUTH_VERIFY_TIMEOUT_MS,
    'AUTH_VERIFY_TIMEOUT'
  );
  if (error || !data?.user) {
    throw new Error('Authentication failed');
  }
  authCache.set(token, { user: data.user, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
  return data.user;
}

