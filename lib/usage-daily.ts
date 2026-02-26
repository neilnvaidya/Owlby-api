import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

type Route = 'chat' | 'lesson' | 'story';

/**
 * Fire-and-forget increment of the daily usage counter for the given route.
 * Uses the `increment_daily_usage` RPC (atomic upsert, no race conditions).
 */
export function incrementDailyUsage(userId: string, route: Route): void {
  const today = new Date().toISOString().slice(0, 10);

  (supabase
    .rpc('increment_daily_usage', {
      p_user_id: userId,
      p_date: today,
      p_route: route,
    }) as Promise<{ error: { message?: string } | null }>)
    .then(({ error }) => {
      if (error) {
        console.error('[USAGE] Failed to increment daily usage:', error.message);
      }
    })
    .catch((err) => {
      console.error('[USAGE] Unexpected error incrementing daily usage:', err);
    });
}
