import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      user_id, 
      email, 
      email_verified, 
      success, 
      token,
      // Auth0 might send these parameters
      verification_ticket,
      result_url,
      message,
      // Mobile detection parameters
      mobile,
      platform
    } = req.query;

    console.info('📧 Email verification callback received:', {
      user_id,
      email,
      email_verified,
      success,
      token,
      verification_ticket,
      result_url,
      message,
      mobile,
      platform,
      userAgent: req.headers['user-agent']
    });

    // Detect if this is a mobile request
    const userAgent = req.headers['user-agent'] || '';
    const isMobile = mobile === 'true' || 
                    /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    
    console.info('📱 Mobile detection result:', { isMobile, platform, userAgent: userAgent.slice(0, 100) });

    // Determine verification status
    const isSuccess = success === 'true' || 
                     email_verified === 'true' || 
                     verification_ticket || 
                     token;

    if (isSuccess) {
      console.info('✅ Email verification successful for:', email || user_id);
      
      if (isMobile) {
        // Deep link to mobile app for successful verification
        const deepLinkUrl = new URL('owlby://auth/verify-email');
        deepLinkUrl.searchParams.set('success', 'true');
        deepLinkUrl.searchParams.set('message', 'Email verified successfully!');
        deepLinkUrl.searchParams.set('verification_ticket', verification_ticket as string || '');
        deepLinkUrl.searchParams.set('token', token as string || '');
        if (email && typeof email === 'string') {
          deepLinkUrl.searchParams.set('email', email);
        }
        
        console.info('📱 Redirecting to mobile app via deep link:', deepLinkUrl.toString());
        
        // Return an HTML page that attempts deep link with fallback
        return res.status(200).send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Email Verified! 🎉</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0; 
      padding: 20px; 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
      max-width: 400px;
    }
    .icon { font-size: 60px; margin-bottom: 20px; }
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
    <div class="icon">🎉</div>
    <h1>Email Verified!</h1>
    <p>Your email has been successfully verified. Opening Owlby now...</p>
    <p><a href="${deepLinkUrl.toString()}" class="button">Open Owlby App</a></p>
    <p style="font-size: 12px; opacity: 0.7;">If the app doesn't open automatically, tap the button above.</p>
  </div>
  
  <script>
    // Attempt automatic deep link redirect
    window.location.href = '${deepLinkUrl.toString()}';
    
    // Fallback timeout in case deep link fails
    setTimeout(function() {
      console.log('Deep link timeout - user may need to tap button');
    }, 3000);
  </script>
</body>
</html>
        `);
      } else {
        // Web redirect for non-mobile devices
      const redirectUrl = new URL('/verify-email', 'https://www.owlby.com');
      redirectUrl.searchParams.set('success', 'true');
      redirectUrl.searchParams.set('message', 'Email verified successfully!');
      if (email && typeof email === 'string') {
        redirectUrl.searchParams.set('email', email);
      }
      
        console.info('🌐 Redirecting to web app:', redirectUrl.toString());
      return res.redirect(302, redirectUrl.toString());
      }
      
    } else {
      console.info('❌ Email verification failed for:', email || user_id);
      
      if (isMobile) {
        // Deep link to mobile app for failed verification
        const deepLinkUrl = new URL('owlby://auth/verify-email');
        deepLinkUrl.searchParams.set('success', 'false');
        deepLinkUrl.searchParams.set('message', 
          (typeof message === 'string' ? message : null) || 'Email verification failed'
        );
        if (email && typeof email === 'string') {
          deepLinkUrl.searchParams.set('email', email);
        }
        
        console.info('📱 Redirecting to mobile app with error via deep link:', deepLinkUrl.toString());
        
        // Return an HTML page that attempts deep link with fallback
        return res.status(200).send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Verification Issue</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0; 
      padding: 20px; 
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
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
      max-width: 400px;
    }
    .icon { font-size: 60px; margin-bottom: 20px; }
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
    <div class="icon">⚠️</div>
    <h1>Verification Issue</h1>
    <p>There was a problem verifying your email. Let's try again in the app.</p>
    <p><a href="${deepLinkUrl.toString()}" class="button">Open Owlby App</a></p>
    <p style="font-size: 12px; opacity: 0.7;">If the app doesn't open automatically, tap the button above.</p>
  </div>
  
  <script>
    // Attempt automatic deep link redirect
    window.location.href = '${deepLinkUrl.toString()}';
    
    // Fallback timeout
    setTimeout(function() {
      console.log('Deep link timeout - user may need to tap button');
    }, 3000);
  </script>
</body>
</html>
        `);
      } else {
        // Web redirect for non-mobile devices
      const redirectUrl = new URL('/verify-email', process.env.NEXT_PUBLIC_APP_URL);
      redirectUrl.searchParams.set('success', 'false');
      redirectUrl.searchParams.set('message', 
        (typeof message === 'string' ? message : null) || 'Email verification failed'
      );
      if (email && typeof email === 'string') {
        redirectUrl.searchParams.set('email', email);
      }
      
        console.info('🌐 Redirecting to web app with error:', redirectUrl.toString());
      return res.redirect(302, redirectUrl.toString());
      }
    }
    
  } catch (error) {
    console.error('❌ Email verification callback error:', error);
    
    // Try to detect mobile even in error case
    const userAgent = req.headers['user-agent'] || '';
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    
    if (isMobile) {
      // Deep link to mobile app with service error
      const deepLinkUrl = new URL('owlby://auth/verify-email');
      deepLinkUrl.searchParams.set('success', 'false');
      deepLinkUrl.searchParams.set('message', 'Verification service error');
      
      console.info('📱 Redirecting to mobile app with service error via deep link:', deepLinkUrl.toString());
      
      return res.status(200).send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Service Error</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0; 
      padding: 20px; 
      background: linear-gradient(135deg, #ff7675 0%, #d63031 100%);
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
      max-width: 400px;
    }
    .icon { font-size: 60px; margin-bottom: 20px; }
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
    <div class="icon">🔧</div>
    <h1>Service Error</h1>
    <p>There was a technical issue with email verification. Let's get you back to the app.</p>
    <p><a href="${deepLinkUrl.toString()}" class="button">Open Owlby App</a></p>
    <p style="font-size: 12px; opacity: 0.7;">If the app doesn't open automatically, tap the button above.</p>
  </div>
  
  <script>
    // Attempt automatic deep link redirect
    window.location.href = '${deepLinkUrl.toString()}';
    
    // Fallback timeout
    setTimeout(function() {
      console.log('Deep link timeout - user may need to tap button');
    }, 3000);
  </script>
</body>
</html>
      `);
    } else {
      // Web redirect for non-mobile devices
    const redirectUrl = new URL('/verify-email', process.env.NEXT_PUBLIC_APP_URL);
    redirectUrl.searchParams.set('success', 'false');
    redirectUrl.searchParams.set('message', 'Verification service error');
    
      console.info('🌐 Redirecting to web app with service error:', redirectUrl.toString());
    return res.redirect(302, redirectUrl.toString());
    }
  }
} 