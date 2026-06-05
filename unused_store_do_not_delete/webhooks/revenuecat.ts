import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET || '';

const ACTIVATE_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
]);

const DEACTIVATE_EVENTS = new Set([
  'CANCELLATION',
  'EXPIRATION',
]);

function platformFromStore(store: string | undefined): 'ios' | 'android' | null {
  if (store === 'APP_STORE' || store === 'MAC_APP_STORE') return 'ios';
  if (store === 'PLAY_STORE') return 'android';
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';
  if (!WEBHOOK_SECRET || authHeader !== WEBHOOK_SECRET) {
    console.warn('[RC WEBHOOK] Unauthorized request');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Respond immediately so RevenueCat doesn't retry
  res.status(200).json({ ok: true });

  try {
    const { event } = req.body || {};
    if (!event) {
      console.warn('[RC WEBHOOK] No event in payload');
      return;
    }

    const eventType: string = event.type;
    const appUserId: string = event.app_user_id;
    const originalAppUserId: string = event.original_app_user_id || appUserId;
    const productId: string = event.product_id || '';
    const entitlementIds: string[] = event.entitlement_ids || [];
    const expiresAtMs: number | null = event.expiration_at_ms;
    const store: string | undefined = event.store;
    const environment: string = event.environment || 'PRODUCTION';

    console.info(`[RC WEBHOOK] ${eventType} | user=${appUserId} | product=${productId} | env=${environment}`);

    const userId = appUserId;
    const platform = platformFromStore(store);
    const expiresAt = expiresAtMs ? new Date(expiresAtMs).toISOString() : null;
    const entitlementId = entitlementIds[0] || 'premium';

    if (ACTIVATE_EVENTS.has(eventType)) {
      const { error } = await supabase
        .from('user_subscription')
        .upsert(
          {
            user_id: userId,
            product_id: productId,
            entitlement_id: entitlementId,
            platform,
            revenuecat_original_app_user_id: originalAppUserId,
            is_active: true,
            expires_at: expiresAt,
            store: store || null,
            event_type: eventType,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (error) {
        console.error('[RC WEBHOOK] Upsert activate error:', error.message);
      }
    } else if (DEACTIVATE_EVENTS.has(eventType)) {
      const { error } = await supabase
        .from('user_subscription')
        .upsert(
          {
            user_id: userId,
            product_id: productId,
            entitlement_id: entitlementId,
            platform,
            revenuecat_original_app_user_id: originalAppUserId,
            is_active: false,
            expires_at: expiresAt,
            store: store || null,
            event_type: eventType,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (error) {
        console.error('[RC WEBHOOK] Upsert deactivate error:', error.message);
      }
    } else if (eventType === 'BILLING_ISSUE') {
      console.warn(`[RC WEBHOOK] BILLING_ISSUE for user=${userId}, product=${productId}`);
      // Keep subscription active for now; RevenueCat retries billing.
      // If it eventually fails, an EXPIRATION event will follow.
    } else {
      console.info(`[RC WEBHOOK] Unhandled event type: ${eventType}`);
    }
  } catch (err: any) {
    console.error('[RC WEBHOOK] Processing error:', err.message);
  }
}
