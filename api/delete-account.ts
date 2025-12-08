import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../lib/supabase';
import { verifyToken } from '../lib/auth';

// Auth0 Management API configuration
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || '';
const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID || '';
const AUTH0_CLIENT_SECRET = process.env.AUTH0_CLIENT_SECRET || '';
const AUTH0_MANAGEMENT_AUDIENCE = `https://${AUTH0_DOMAIN}/api/v2/`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow DELETE method
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Extract token from Authorization header
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  
  try {
    // Verify token and get user info
    const decoded: any = await verifyToken(token);
    const auth0UserId = decoded.sub;
    
    console.info('Starting account deletion');
    
    // Step 1: Delete user from Supabase
    try {
      const { error: supabaseError } = await supabase
        .from('users')
        .delete()
        .eq('auth0_id', auth0UserId);
      
      if (supabaseError) {
        console.error('Supabase deletion error:', supabaseError);
        // Continue with Auth0 deletion even if Supabase fails
      } else {
        console.info('Deleted user from Supabase');
      }
    } catch (supabaseError) {
      console.error('Supabase deletion failed:', supabaseError);
      // Continue with Auth0 deletion even if Supabase fails
    }
    
    // Step 2: Delete user from Auth0
    try {
      // Get Auth0 Management API access token
      const managementToken = await getAuth0ManagementToken();
      
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
        console.error('Auth0 deletion error:', deleteResponse.status, errorText);
        throw new Error(`Auth0 deletion failed: ${deleteResponse.status}`);
      }
      
      console.info('Deleted user from Auth0');
    } catch (auth0Error) {
      console.error('Auth0 deletion failed:', auth0Error);
      return res.status(500).json({ 
        error: 'Failed to delete account from authentication system',
        details: auth0Error instanceof Error ? auth0Error.message : 'Unknown error'
      });
    }
    
    console.info('Account deletion completed successfully');
    return res.status(200).json({ 
      success: true, 
      message: 'Account successfully deleted' 
    });
    
  } catch (error) {
    console.error('Account deletion error:', error);
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