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
    // Use the chat route as the reference for free-tier limits in this status API
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
    console.error('[SUBSCRIPTION STATUS] Error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to check subscription status',
      userMessage: 'Something went wrong. Please try again.',
    });
  }
}
