import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { supabase } from './supabase';

const EMAIL_VERIFICATION_SECRET =
  process.env.EMAIL_VERIFICATION_SECRET ||
  process.env.API_EMAIL_VERIFICATION_SECRET;

const TOKEN_TTL_SECONDS = Number(process.env.EMAIL_VERIFICATION_TTL_SECONDS || 1800); // 30 minutes
const PURPOSE = 'email-verify';

export interface VerificationPayload {
  sub: number;
  email: string;
  jti: string;
  purpose: string;
  exp: number;
}

function assertSecret() {
  if (!EMAIL_VERIFICATION_SECRET) {
    throw new Error('EMAIL_VERIFICATION_SECRET is not configured');
  }
}

export async function createVerificationToken(userId: number, email: string) {
  assertSecret();
  const jti = crypto.randomUUID();
  const expSeconds = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload: VerificationPayload = {
    sub: userId,
    email,
    jti,
    purpose: PURPOSE,
    exp: expSeconds,
  };

  const token = jwt.sign(payload, EMAIL_VERIFICATION_SECRET, {
    algorithm: 'HS256',
  });

  const expiresAt = new Date(expSeconds * 1000).toISOString();

  const { error } = await supabase.from('email_verification_tokens').insert({
    jti,
    user_id: userId,
    purpose: PURPOSE,
    expires_at: expiresAt,
  });

  if (error) {
    throw error;
  }

  return { token, jti, expiresAt };
}

export async function verifyAndConsumeToken(token: string): Promise<VerificationPayload> {
  assertSecret();
  let decoded: VerificationPayload;

  try {
    decoded = jwt.verify(token, EMAIL_VERIFICATION_SECRET, {
      algorithms: ['HS256'],
    }) as VerificationPayload;
  } catch (err) {
    throw new Error('Invalid or expired verification token');
  }

  if (decoded.purpose !== PURPOSE) {
    throw new Error('Invalid verification token purpose');
  }

  const { data: record, error } = await supabase
    .from('email_verification_tokens')
    .select('*')
    .eq('jti', decoded.jti)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (!record) {
    throw new Error('Verification token is unknown or already used');
  }

  const now = new Date();
  if (record.consumed_at) {
    throw new Error('Verification token has already been used');
  }

  if (record.expires_at && new Date(record.expires_at) < now) {
    throw new Error('Verification token has expired');
  }

  // Mark consumed
  const { error: consumeError } = await supabase
    .from('email_verification_tokens')
    .update({ consumed_at: now.toISOString() })
    .eq('jti', decoded.jti);

  if (consumeError) {
    throw consumeError;
  }

  return decoded;
}








