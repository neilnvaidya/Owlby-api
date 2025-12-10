import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../lib/supabase';
import { verifyAndConsumeToken } from '../lib/verification-token';

  const webBaseUrl = process.env.WEB_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://owlby.com';

function isMobileRequest(req: NextApiRequest, mobileParam?: string | string[]) {
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token =
    typeof req.body?.token === 'string'
      ? req.body.token
      : typeof req.query.token === 'string'
        ? req.query.token
        : '';

  if (!token) {
    return res.status(400).json({ success: false, error: 'Missing verification token' });
  }

  try {
    const payload = await verifyAndConsumeToken(token);
    const updatedUser = await markSupabaseVerified(payload.sub);

    const message = 'Email verified successfully!';

    if (req.method === 'GET') {
      const mobile = isMobileRequest(req, req.query.mobile);

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
      const mobile = isMobileRequest(req, req.query.mobile);

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