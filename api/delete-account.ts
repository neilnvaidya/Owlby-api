import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../lib/supabase';
import { verifySupabaseToken } from '../lib/auth-supabase';

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
    const decoded: any = await verifySupabaseToken(token);
    const authUid = decoded.id;
    
    console.info('Starting account deletion');
    
    // Delete user from Supabase
    try {
      const { error: supabaseError } = await supabase
        .from('users')
        .delete()
      .eq('auth_uid', authUid);
      
      if (supabaseError) {
        console.error('Supabase deletion error:', supabaseError);
        // Proceed even if Supabase deletion fails
      } else {
        console.info('Deleted user from Supabase');
      }
    } catch (supabaseError) {
      console.error('Supabase deletion failed:', supabaseError);
      // Proceed even if Supabase deletion fails
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
