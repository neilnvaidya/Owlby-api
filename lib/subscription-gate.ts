import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Per-route free tier limits (per user, per day)
const FREE_TIER_CHAT_LIMIT = Number(process.env.FREE_TIER_CHAT_LIMIT ?? 10);
const FREE_TIER_LESSON_LIMIT = Number(process.env.FREE_TIER_LESSON_LIMIT ?? 5);
const FREE_TIER_STORY_LIMIT = Number(process.env.FREE_TIER_STORY_LIMIT ?? 5);

const GATE_TIMEOUT_MS = 4000;

export type SubscriptionTier = 'premium' | 'early_adopter' | 'free';
export type RouteType = 'chat' | 'lesson' | 'story';

export interface GateResult {
  allowed: boolean;
  reason?: 'subscription_required' | 'daily_limit_reached';
  tier: SubscriptionTier;
  dailyUsage?: { chat: number; lesson: number; story: number; total: number };
  dailyLimit: number; // limit for the specific route being checked
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let tid: NodeJS.Timeout;
  return new Promise<T>((resolve, reject) => {
    tid = setTimeout(() => reject(new Error('GATE_TIMEOUT')), ms);
    promise.then(resolve).catch(reject);
  }).finally(() => clearTimeout(tid));
}

function getRouteLimit(route: RouteType): number {
  switch (route) {
    case 'chat':
      return FREE_TIER_CHAT_LIMIT;
    case 'lesson':
      return FREE_TIER_LESSON_LIMIT;
    case 'story':
      return FREE_TIER_STORY_LIMIT;
    default:
      return FREE_TIER_CHAT_LIMIT;
  }
}

export async function canGenerate(userId: string, route: RouteType): Promise<GateResult> {
  const limit = getRouteLimit(route);
  try {
    return await withTimeout(checkAccess(userId, route, limit), GATE_TIMEOUT_MS);
  } catch (err: any) {
    // On timeout or DB error, fail open so we don't block paying users
    console.error('[GATE] Error checking subscription, failing open:', err.message);
    return { allowed: true, tier: 'free', dailyLimit: limit };
  }
}

async function checkAccess(
  userId: string,
  route: RouteType,
  routeLimit: number
): Promise<GateResult> {
  const now = new Date().toISOString();

  // 1. Active subscription
  const { data: sub } = await supabase
    .from('user_subscription')
    .select('is_active, expires_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .gte('expires_at', now)
    .maybeSingle();

  if (sub) {
    return { allowed: true, tier: 'premium', dailyLimit: routeLimit };
  }

  // 2. Early adopter
  const { data: user } = await supabase
    .from('users')
    .select('is_early_adopter')
    .eq('auth_uid', userId)
    .maybeSingle();

  if (user?.is_early_adopter) {
    return { allowed: true, tier: 'early_adopter', dailyLimit: routeLimit };
  }

  // 3. Free tier — check daily usage
  const today = new Date().toISOString().slice(0, 10);
  const { data: usage } = await supabase
    .from('user_usage_daily')
    .select('chat_count, lesson_count, story_count')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  const dailyUsage = {
    chat: usage?.chat_count ?? 0,
    lesson: usage?.lesson_count ?? 0,
    story: usage?.story_count ?? 0,
    total: (usage?.chat_count ?? 0) + (usage?.lesson_count ?? 0) + (usage?.story_count ?? 0),
  };

  const currentCount =
    route === 'chat'
      ? dailyUsage.chat
      : route === 'lesson'
      ? dailyUsage.lesson
      : dailyUsage.story;

  if (currentCount >= routeLimit) {
    return {
      allowed: false,
      reason: 'daily_limit_reached',
      tier: 'free',
      dailyUsage,
      dailyLimit: routeLimit,
    };
  }

  return { allowed: true, tier: 'free', dailyUsage, dailyLimit: routeLimit };
}

