import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySupabaseToken } from '../lib/auth-supabase';
import { canGenerate } from '../lib/subscription-gate';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    return res.status(204).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  const scope =
    (typeof req.query.scope === 'string' ? req.query.scope : undefined) || 'health';

  if (scope === 'health') {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const timestamp = new Date().toISOString();
    const method = req.method || 'GET';
    const url = req.url || '/health';
    const userAgent = req.headers?.['user-agent'] || 'unknown';
    const ip =
      (req.headers?.['x-forwarded-for'] as string | undefined) ||
      (req.headers?.['x-real-ip'] as string | undefined) ||
      (req.socket as any)?.remoteAddress ||
      'unknown';

    console.log(`[HEALTH CHECK] ${timestamp} - ${method} ${url}`);
    console.log(`[HEALTH] IP: ${ip} | User-Agent: ${userAgent}`);
    console.log(
      '[HEALTH] Request details:',
      JSON.stringify(
        {
          timestamp,
          method,
          url,
          userAgent,
          ip,
          headers: {
            'x-forwarded-for': req.headers?.['x-forwarded-for'],
            'x-real-ip': req.headers?.['x-real-ip'],
            'user-agent': userAgent,
            host: req.headers?.host,
          },
        },
        null,
        2
      )
    );

    return res.status(200).json({
      status: 'ok',
      timestamp,
      service: 'owlby-api',
      version: '1.0.0',
    });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Missing authorization token',
      userMessage: 'Please sign in again.',
    });
  }

  let decoded: any;
  try {
    decoded = await verifySupabaseToken(token);
  } catch {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      userMessage: 'Session expired. Please sign in again.',
    });
  }

  const userId = decoded?.id || 'unknown';

  try {
    const gate = await canGenerate(userId, 'chat');

    let subscriptionStatus: 'active' | 'expired' | 'none' | 'free_tier';
    if (gate.tier === 'premium') {
      subscriptionStatus = 'active';
    } else if (gate.tier === 'early_adopter') {
      subscriptionStatus = 'active';
    } else if (gate.allowed) {
      subscriptionStatus = 'free_tier';
    } else {
      subscriptionStatus = 'none';
    }

    return res.status(200).json({
      success: true,
      canGenerate: gate.allowed,
      subscriptionStatus,
      tier: gate.tier,
      dailyUsage: gate.dailyUsage || null,
      dailyLimit: gate.dailyLimit,
      limitReached: !gate.allowed && gate.reason === 'daily_limit_reached',
    });
  } catch (err: any) {
    console.error('[STATUS] Error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to check subscription status',
      userMessage: 'Something went wrong. Please try again.',
    });
  }
}

