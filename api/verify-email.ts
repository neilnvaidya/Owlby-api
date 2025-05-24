import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Auth0 Email Verification Callback Handler
 * 
 * This endpoint handles email verification callbacks from Auth0.
 * It processes the verification result and can trigger additional actions
 * like updating user metadata or sending notifications.
 */

interface VerificationCallbackData {
  user_id?: string;
  email?: string;
  email_verified?: boolean;
  success?: boolean;
  token?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests for email verification callbacks
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only GET requests are allowed for email verification'
    });
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
      result_url
    } = req.query;

    console.log('📧 Email verification callback received:', {
      user_id,
      email,
      email_verified,
      success,
      token,
      verification_ticket,
      result_url
    });

    // Determine verification status
    const isSuccess = success === 'true' || 
                     email_verified === 'true' || 
                     verification_ticket || 
                     token;

    if (isSuccess) {
      console.log('✅ Email verification successful for:', email || user_id);
      
      // Here you could add additional logic like:
      // - Update user metadata in Auth0
      // - Send welcome email
      // - Log verification event
      // - Update database records
      
      // For now, redirect to web app with success
      const redirectUrl = new URL('/verify-email', 'https://www.owlby.com');
      redirectUrl.searchParams.set('success', 'true');
      redirectUrl.searchParams.set('message', 'Email verified successfully!');
      if (email) redirectUrl.searchParams.set('email', email as string);
      
      return res.redirect(302, redirectUrl.toString());
      
    } else {
      console.log('❌ Email verification failed for:', email || user_id);
      
      // Redirect to web app with error
      const redirectUrl = new URL('/verify-email', 'https://www.owlby.com');
      redirectUrl.searchParams.set('success', 'false');
      redirectUrl.searchParams.set('message', 
        req.query.message as string || 'Email verification failed'
      );
      if (email) redirectUrl.searchParams.set('email', email as string);
      
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

// Export config for Vercel
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
} 