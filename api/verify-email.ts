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
      message
    } = req.query;

    console.log('📧 Email verification callback received:', {
      user_id,
      email,
      email_verified,
      success,
      token,
      verification_ticket,
      result_url,
      message
    });

    // Determine verification status
    const isSuccess = success === 'true' || 
                     email_verified === 'true' || 
                     verification_ticket || 
                     token;

    if (isSuccess) {
      console.log('✅ Email verification successful for:', email || user_id);
      
      // Redirect to web app with success
      const redirectUrl = new URL('/verify-email', 'https://www.owlby.com');
      redirectUrl.searchParams.set('success', 'true');
      redirectUrl.searchParams.set('message', 'Email verified successfully!');
      if (email && typeof email === 'string') {
        redirectUrl.searchParams.set('email', email);
      }
      
      return res.redirect(302, redirectUrl.toString());
      
    } else {
      console.log('❌ Email verification failed for:', email || user_id);
      
      // Redirect to web app with error
      const redirectUrl = new URL('/verify-email', 'https://www.owlby.com');
      redirectUrl.searchParams.set('success', 'false');
      redirectUrl.searchParams.set('message', 
        (typeof message === 'string' ? message : null) || 'Email verification failed'
      );
      if (email && typeof email === 'string') {
        redirectUrl.searchParams.set('email', email);
      }
      
      return res.redirect(302, redirectUrl.toString());
    }
    
  } catch (error) {
    console.error('❌ Email verification callback error:', error);
    
    // Redirect to web app with error
    const redirectUrl = new URL('/verify-email', 'https://www.owlby.com');
    redirectUrl.searchParams.set('success', 'false');
    redirectUrl.searchParams.set('message', 'Verification service error');
    
    return res.redirect(302, redirectUrl.toString());
  }
} 