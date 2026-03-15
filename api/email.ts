import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySupabaseToken } from '../lib/auth-supabase.js';
import { supabase } from '../lib/supabase.js';
import { createVerificationToken, verifyAndConsumeToken } from '../lib/verification-token.js';

const webBaseUrl =
  process.env.WEB_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://owlby.com';

// --- Send/Resend (from email-verification) ---

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

async function findUser(authUid: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth_uid', authUid)
    .single();

  if (error) {
    throw error;
  }

  return data;
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

// --- Verify (consume token, from verify-email) ---

function isMobileRequest(req: VercelRequest, mobileParam?: string | string[]) {
  const userAgent = req.headers['user-agent'] || '';
  return (
    mobileParam === 'true' ||
    /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
  );
}

function buildDeepLink(success: boolean, message?: string, email?: string) {
  const deepLinkUrl = new URL('owlby://auth/verify-email');
  deepLinkUrl.searchParams.set('success', success ? 'true' : 'false');
  if (message) deepLinkUrl.searchParams.set('message', message);
  if (email) deepLinkUrl.searchParams.set('email', email);
  return deepLinkUrl.toString();
}

function renderDeepLinkPage(title: string, body: string, href: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0; 
      padding: 20px; 
      background: linear-gradient(135deg, #1f1d47 0%, #712b75 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      text-align: center;
    }
    .container {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 30px;
      max-width: 420px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.25);
    }
    h1 { margin: 0 0 10px 0; font-size: 24px; }
    p { margin: 10px 0; opacity: 0.9; line-height: 1.5; }
    .button {
      display: inline-block;
      background: #DE3A8F;
      color: white;
      padding: 12px 24px;
      border-radius: 25px;
      text-decoration: none;
      margin: 10px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
    <p>${body}</p>
    <p><a href="${href}" class="button">Open Owlby App</a></p>
    <p style="font-size: 12px; opacity: 0.7;">If the app doesn't open automatically, tap the button above.</p>
  </div>
  <script>
    window.location.href = '${href}';
    setTimeout(function() {
      console.log('Deep link timeout - user may need to tap button');
    }, 2000);
  </script>
</body>
</html>
`;
}

async function markSupabaseVerified(userId: number) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('users')
    .update({ email_verified_at: now, verified_via: 'email-link' })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('User not found while verifying email');
  }

  return data;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const verificationToken =
    typeof (req.body as any)?.token === 'string'
      ? (req.body as any).token
      : typeof req.query.token === 'string'
        ? req.query.token
        : '';

  // --- Verify (consume token): GET or POST with token ---
  if (verificationToken) {
    try {
      const payload = await verifyAndConsumeToken(verificationToken);
      const updatedUser = await markSupabaseVerified(payload.sub);

      const message = 'Email verified successfully!';

      if (req.method === 'GET') {
        const mobile = isMobileRequest(req, req.query.mobile as string | string[] | undefined);

        if (mobile) {
          const href = buildDeepLink(true, message, payload.email);
          return res
            .status(200)
            .send(renderDeepLinkPage('Email Verified', 'Opening Owlby now...', href));
        }

        const redirectUrl = new URL('/verify-email', webBaseUrl);
        redirectUrl.searchParams.set('success', 'true');
        redirectUrl.searchParams.set('message', message);
        redirectUrl.searchParams.set('email', payload.email);
        return res.redirect(302, redirectUrl.toString());
      }

      return res.status(200).json({
        success: true,
        email: payload.email,
        email_verified_at: updatedUser.email_verified_at,
        verified_via: updatedUser.verified_via,
      });
    } catch (error: any) {
      const errorMessage = error?.message || 'Email verification failed';

      if (req.method === 'GET') {
        const mobile = isMobileRequest(req, req.query.mobile as string | string[] | undefined);

        if (mobile) {
          const href = buildDeepLink(false, errorMessage);
          return res
            .status(200)
            .send(renderDeepLinkPage('Verification Issue', errorMessage, href));
        }

        const redirectUrl = new URL('/verify-email', webBaseUrl);
        redirectUrl.searchParams.set('success', 'false');
        redirectUrl.searchParams.set('message', errorMessage);
        return res.redirect(302, redirectUrl.toString());
      }

      return res.status(400).json({ success: false, error: errorMessage });
    }
  }

  // --- Send/Resend: POST with auth ---
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

    const actionFromQuery =
      typeof req.query.action === 'string' ? req.query.action : undefined;
    const actionFromBody =
      typeof (req.body as any)?.action === 'string' ? (req.body as any).action : undefined;
    const action = (actionFromQuery || actionFromBody || 'send').toLowerCase();

    let user;
    if (action === 'resend') {
      user = await findUser(decoded.id);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: 'User not found for resend' });
      }
    } else {
      user = await getOrCreateUser(decoded.id, email);
    }

    if (user.email_verified_at) {
      return res.status(200).json({ success: true, already_verified: true });
    }

    await ensureNotRateLimited(user.id);

    const { token: newVerificationToken, expiresAt } = await createVerificationToken(
      user.id,
      email
    );
    const verificationLink = `${webBaseUrl}/verify-email?token=${encodeURIComponent(
      newVerificationToken
    )}`;

    return res.status(200).json({
      success: true,
      link: verificationLink,
      expires_at: expiresAt,
    });
  } catch (error: any) {
    console.error('email-verification error:', error);
    return res.status(400).json({
      success: false,
      error: error?.message || 'Failed to process email verification request',
    });
  }
}
