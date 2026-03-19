import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

type Route = 'chat' | 'lesson' | 'story';

/**
 * Increment the daily usage counter for the given route.
 *
 * Lesson v3: `lesson` is incremented once per session on POST /api/lesson/start only
 * (see api/lesson/start.ts). Chunk/evaluate/consolidation/objectives do not increment,
 * so one interactive lesson still counts as one "lesson" for free-tier limits.
 * Uses the `increment_daily_usage` RPC (atomic upsert, no race conditions).
 * Must be awaited so the request runs before the serverless runtime freezes
 * (fire-and-forget caused "fetch failed" after response was sent).
 */
export async function incrementDailyUsage(userId: string, route: Route): Promise<void> {
  if (!supabase) {
    if (!supabaseUrl || !supabaseKey) {
      console.warn('[USAGE] Supabase URL or service role key missing; skipping daily usage increment');
    }
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  try {
    const { error } = (await supabase.rpc('increment_daily_usage', {
      p_user_id: userId,
      p_date: today,
      p_route: route,
    })) as { error: { message?: string } | null };

    if (error) {
      console.error('[USAGE] Failed to increment daily usage:', error.message);
    }
  } catch (err: any) {
    console.error('[USAGE] Unexpected error incrementing daily usage:', err?.message ?? err, err?.cause ?? '');
  }
}
