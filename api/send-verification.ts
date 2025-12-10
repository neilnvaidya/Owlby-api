import { NextApiRequest, NextApiResponse } from 'next';
import { verifySupabaseToken } from '../lib/auth-supabase';
import { supabase } from '../lib/supabase';
import { createVerificationToken } from '../lib/verification-token';

const webBaseUrl = process.env.WEB_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://owlby.com';

async function getOrCreateUser(authUid: string, email: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth_uid', authUid)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (data) {
    return data;
  }

  const now = new Date().toISOString();
  const { data: inserted, error: insertError } = await supabase
    .from('users')
    .insert({
      auth_uid: authUid,
      email,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (insertError) {
    throw insertError;
  }

  return inserted;
}

async function ensureNotRateLimited(userId: number) {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('email_verification_tokens')
    .select('jti')
    .eq('user_id', userId)
    .gte('issued_at', twoMinutesAgo)
    .limit(1);

  if (error) {
    throw error;
  }

  if (data && data.length > 0) {
    throw new Error('Please wait a moment before requesting another verification email.');
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Missing token' });
    }

    const decoded: any = await verifySupabaseToken(token);
    const email = decoded.email as string | undefined;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required on token' });
    }

    const user = await getOrCreateUser(decoded.id, email);
    if (user.email_verified_at) {
      return res.status(200).json({ success: true, already_verified: true });
    }

    await ensureNotRateLimited(user.id);

    const { token: verificationToken, expiresAt } = await createVerificationToken(user.id, email);
    const verificationLink = `${webBaseUrl}/verify-email?token=${encodeURIComponent(verificationToken)}`;

    // NOTE: Email dispatch should be wired to your provider. For now we return the link for the caller to send.
    return res.status(200).json({
      success: true,
      link: verificationLink,
      expires_at: expiresAt,
    });
  } catch (error: any) {
    console.error('send-verification error:', error);
    return res.status(400).json({ success: false, error: error?.message || 'Failed to send verification' });
  }
}

