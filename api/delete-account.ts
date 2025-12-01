import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../lib/supabase';
import { verifyToken } from '../lib/auth';

// Auth0 Management API configuration
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || '';
const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID || '';
const AUTH0_CLIENT_SECRET = process.env.AUTH0_CLIENT_SECRET || '';
const AUTH0_MANAGEMENT_AUDIENCE = `https://${AUTH0_DOMAIN}/api/v2/`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  
  console.info('🗑️ [delete-account] ========== REQUEST START ==========');
  console.info('🗑️ [delete-account] REQUEST:', JSON.stringify({
    method: req.method,
    url: req.url,
    hasAuthHeader: !!req.headers.authorization
  }, null, 2));
  
  // Only allow DELETE method
  if (req.method !== 'DELETE') {
    console.warn('🗑️ [delete-account] Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Extract token from Authorization header
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  
  if (!token) {
    console.warn('🗑️ [delete-account] Missing or invalid token');
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  
  try {
    // Verify token and get user info
    const decoded: any = await verifyToken(token);
    const auth0UserId = decoded.sub;
    
    console.info('🗑️ [delete-account] User authenticated:', {
      userId: auth0UserId?.substring(0, 8) + '...',
      email: decoded.email
    });
    console.info('🗑️ [delete-account] Starting account deletion for user:', auth0UserId.substring(0, 8) + '...');
    
    // Step 1: Delete user from Supabase
    try {
      const { error: supabaseError } = await supabase
        .from('users')
        .delete()
        .eq('auth0_id', auth0UserId);
      
      if (supabaseError) {
        console.error('🗑️ [delete-account] Supabase deletion error:', supabaseError);
        // Continue with Auth0 deletion even if Supabase fails
      } else {
        console.info('🗑️ [delete-account] Successfully deleted user from Supabase');
      }
    } catch (supabaseError) {
      console.error('🗑️ [delete-account] Supabase deletion failed:', {
        error: supabaseError instanceof Error ? supabaseError.message : 'Unknown error',
        stack: supabaseError instanceof Error ? supabaseError.stack : undefined
      });
      // Continue with Auth0 deletion even if Supabase fails
    }
    
    // Step 2: Delete user from Auth0
    try {
      console.info('🗑️ [delete-account] Getting Auth0 Management API token');
      // Get Auth0 Management API access token
      const managementToken = await getAuth0ManagementToken();
      
      console.info('🗑️ [delete-account] Deleting user from Auth0');
      // Delete user from Auth0
      const deleteResponse = await fetch(`https://${AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(auth0UserId)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${managementToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        console.error('🗑️ [delete-account] Auth0 deletion error:', {
          status: deleteResponse.status,
          statusText: deleteResponse.statusText,
          errorText
        });
        throw new Error(`Auth0 deletion failed: ${deleteResponse.status}`);
      }
      
      console.info('🗑️ [delete-account] Successfully deleted user from Auth0');
    } catch (auth0Error) {
      const totalMs = Date.now() - startTime;
      console.error('🗑️ [delete-account] ========== REQUEST ERROR ==========');
      console.error('🗑️ [delete-account] Auth0 deletion failed:', {
        error: auth0Error instanceof Error ? auth0Error.message : 'Unknown error',
        stack: auth0Error instanceof Error ? auth0Error.stack : undefined,
        duration: totalMs
      });
      return res.status(500).json({ 
        error: 'Failed to delete account from authentication system',
        details: auth0Error instanceof Error ? auth0Error.message : 'Unknown error'
      });
    }
    
    const totalMs = Date.now() - startTime;
    console.info('🗑️ [delete-account] ========== REQUEST COMPLETE ==========');
    console.info(`🗑️ [delete-account] Account deletion completed successfully for user: ${auth0UserId.substring(0, 8)}... (${totalMs}ms)`);
    
    const response = { 
      success: true, 
      message: 'Account successfully deleted' 
    };
    console.info('🗑️ [delete-account] FULL RESPONSE BEING SENT:', JSON.stringify(response, null, 2));
    
    return res.status(200).json(response);
    
  } catch (error) {
    const totalMs = Date.now() - startTime;
    console.error('🗑️ [delete-account] ========== REQUEST ERROR ==========');
    console.error('🗑️ [delete-account] Account deletion error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: totalMs
    });
    return res.status(500).json({ 
      error: 'Failed to delete account',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Helper function to get Auth0 Management API access token
async function getAuth0ManagementToken(): Promise<string> {
  const tokenResponse = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: AUTH0_CLIENT_ID,
      client_secret: AUTH0_CLIENT_SECRET,
      audience: AUTH0_MANAGEMENT_AUDIENCE,
      grant_type: 'client_credentials',
    }),
  });
  
  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Auth0 Management API token error:', tokenResponse.status, errorText);
    throw new Error(`Failed to get Auth0 Management API token: ${tokenResponse.status}`);
  }
  
  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
} 