import type { VercelRequest, VercelResponse } from '@vercel/node';
import { UserProfile } from './profile.types';
import { supabase } from '../lib/supabase';
import { verifyToken } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    
    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        return await getProfile(auth0UserId, decoded, res);
      case 'POST':
        return await updateProfile(auth0UserId, decoded, req.body, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Profile API error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

// GET profile handler
async function getProfile(auth0UserId: string, decoded: any, res: VercelResponse) {
  try {
    // Check if user exists in database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('auth0_id', auth0UserId)
      .single();
    
    if (userError && userError.code !== 'PGRST116') { // PGRST116 is "not found"
      throw userError;
    }
    
    // If user exists in database, return combined profile
    if (userData) {
      const profile: UserProfile = {
        user_id: auth0UserId,
        name: userData.name || decoded.name || '',
        email: decoded.email || '',
        picture: userData.avatar_url || decoded.picture || undefined,
        grade_level: userData.grade_level || undefined,
        interests: userData.interests || undefined,
        achievements: userData.achievements || undefined,
        parent_email: userData.parent_email || undefined,
      };
      
      return res.status(200).json(profile);
    }
    
    // If user doesn't exist yet, create a new record
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{
        auth0_id: auth0UserId,
        name: decoded.name || '',
        email: decoded.email || '',
        avatar_url: decoded.picture || null,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();
    
    if (insertError) throw insertError;
    
    // Return basic profile for new user
    const newProfile: UserProfile = {
      user_id: auth0UserId,
      name: decoded.name || '',
      email: decoded.email || '',
      picture: decoded.picture || undefined,
    };
    
    return res.status(200).json(newProfile);
  } catch (error) {
    console.error('Get profile error:', error);
    
    // Fallback to Auth0 info from JWT
    const fallbackProfile: UserProfile = {
      user_id: auth0UserId,
      name: decoded.name || '',
      email: decoded.email || '',
      picture: decoded.picture || undefined,
    };
    
    return res.status(200).json(fallbackProfile);
  }
}

// POST profile update handler
async function updateProfile(auth0UserId: string, decoded: any, updateData: any, res: VercelResponse) {
  try {
    // Check if user exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('auth0_id', auth0UserId)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }
    
    // Validate update data
    const validatedData: any = {};
    if (updateData.name) validatedData.name = String(updateData.name).slice(0, 100);
    if (updateData.parent_email) validatedData.parent_email = String(updateData.parent_email).slice(0, 255);
    if (typeof updateData.grade_level === 'number') validatedData.grade_level = Math.min(Math.max(0, updateData.grade_level), 12);
    if (Array.isArray(updateData.interests)) validatedData.interests = updateData.interests.map(String).slice(0, 20);
    
    // Update or insert user record
    if (existingUser) {
      // Update existing user
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(validatedData)
        .eq('auth0_id', auth0UserId)
        .select()
        .single();
      
      if (updateError) throw updateError;
      
      // Return updated profile
      const profile: UserProfile = {
        user_id: auth0UserId,
        name: updatedUser.name || decoded.name || '',
        email: decoded.email || '',
        picture: updatedUser.avatar_url || decoded.picture || undefined,
        grade_level: updatedUser.grade_level || undefined,
        interests: updatedUser.interests || undefined,
        achievements: updatedUser.achievements || undefined,
        parent_email: updatedUser.parent_email || undefined,
      };
      
      return res.status(200).json(profile);
    } else {
      // Insert new user
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{
          auth0_id: auth0UserId,
          name: validatedData.name || decoded.name || '',
          email: decoded.email || '',
          avatar_url: decoded.picture || null,
          grade_level: validatedData.grade_level,
          interests: validatedData.interests,
          parent_email: validatedData.parent_email,
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      // Return new profile
      const profile: UserProfile = {
        user_id: auth0UserId,
        name: newUser.name || '',
        email: decoded.email || '',
        picture: newUser.avatar_url || undefined,
        grade_level: newUser.grade_level || undefined,
        interests: newUser.interests || undefined,
        achievements: newUser.achievements || undefined,
        parent_email: newUser.parent_email || undefined,
      };
      
      return res.status(200).json(profile);
    }
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
} 