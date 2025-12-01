import type { VercelRequest, VercelResponse } from '@vercel/node';
import { UserProfile } from '../lib/profile-types';
import { supabase } from '../lib/supabase';
import { verifyToken } from '../lib/auth';

/**
 * Onboarding-specific profile update API
 * Handles the transition from Auth0 authentication to Supabase user profiles
 * Specifically designed for the onboarding flow where we collect age/grade data
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  
  console.info('📝 [update-profile] ========== REQUEST START ==========');
  console.info('📝 [update-profile] REQUEST:', JSON.stringify({
    method: req.method,
    url: req.url,
    hasAuthHeader: !!req.headers.authorization,
    bodyKeys: req.body ? Object.keys(req.body) : []
  }, null, 2));
  
  if (req.method !== 'POST') {
    console.warn('📝 [update-profile] Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, age, userId } = req.body;
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    
    console.info('📝 [update-profile] Onboarding profile update request:', { 
      name: name?.slice(0, 10) + '...', 
      age, 
      userId: userId?.slice(0, 15) + '...', 
      hasAuth: !!authHeader 
    });
    console.info('📝 [update-profile] REQUEST BODY:', JSON.stringify({
      name: name?.slice(0, 20),
      age,
      userId: userId?.substring(0, 8) + '...'
    }, null, 2));
    
    // Validate authorization
    if (!token) {
      return res.status(401).json({ 
        error: 'unauthorized',
        message: 'Authorization token required' 
      });
    }

    // Validate required fields
    if (!name || !age || !userId) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Name, age, and userId are required'
      });
    }

    // Verify token and get user info
    const decoded: any = await verifyToken(token);
    const auth0UserId = decoded.sub;
    
    // Ensure the userId matches the token (security check)
    if (auth0UserId !== userId) {
      console.warn('⚠️ Security: User ID mismatch in onboarding request:', { 
        tokenUserId: auth0UserId, 
        requestUserId: userId 
      });
      return res.status(403).json({ 
        error: 'forbidden',
        message: 'User ID mismatch' 
      });
    }

    // Convert age to grade level estimation
    // This is an approximation: age 5-6 = K, 6-7 = 1st, etc.
    const ageNum = parseInt(age);
    const estimatedGradeLevel = Math.max(0, Math.min(12, ageNum - 5));
    
    // Validate and prepare onboarding data for Supabase
    const onboardingData = {
      name: String(name).trim().slice(0, 100),
      grade_level: estimatedGradeLevel,
      // Initialize empty arrays for future expansion
      interests: [],
      achievements: []
    };

    console.info('📊 Onboarding data transformation:', {
      originalAge: ageNum,
      estimatedGradeLevel,
      name: onboardingData.name.slice(0, 10) + '...'
    });

    // Use the existing profile update logic
    const result = await updateOnboardingProfile(auth0UserId, decoded, onboardingData, res, startTime);
    return result;
    
  } catch (error) {
    const totalMs = Date.now() - startTime;
    console.error('📝 [update-profile] ========== REQUEST ERROR ==========');
    console.error('📝 [update-profile] Onboarding profile update error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: totalMs
    });
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to update onboarding profile'
    });
  }
}

/**
 * Onboarding-specific profile update handler
 * Creates or updates user profile in Supabase with onboarding data
 */
async function updateOnboardingProfile(
  auth0UserId: string, 
  decoded: any, 
  onboardingData: any, 
  res: VercelResponse,
  startTime: number
) {
  try {
    console.info('📝 [update-profile] Checking if user exists in Supabase');
    // Check if user exists in Supabase
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('auth0_id', auth0UserId)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('📝 [update-profile] Error checking existing user:', checkError);
      throw checkError;
    }
    
    const userData = {
      name: onboardingData.name,
      grade_level: onboardingData.grade_level,
      interests: onboardingData.interests,
      achievements: onboardingData.achievements,
      last_login_at: new Date().toISOString()
    };

    console.info('📝 [update-profile] Prepared user data:', JSON.stringify({
      ...userData,
      achievements: Array.isArray(userData.achievements) ? `[${userData.achievements.length} items]` : userData.achievements
    }, null, 2));

    if (existingUser) {
      // Update existing user with onboarding data
      console.info('📝 [update-profile] Updating existing user with onboarding data:', auth0UserId.substring(0, 8) + '...');
      
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(userData)
        .eq('auth0_id', auth0UserId)
        .select()
        .single();
      
      if (updateError) {
        console.error('📝 [update-profile] Error updating user:', updateError);
        throw updateError;
      }
      
      console.info('📝 [update-profile] User profile updated successfully with onboarding data');
      
      // Return updated profile
      const profile = {
        user_id: auth0UserId,
        name: updatedUser.name || '',
        email: decoded.email || '',
        picture: updatedUser.avatar_url || decoded.picture || undefined,
        grade_level: updatedUser.grade_level || undefined,
        interests: updatedUser.interests || undefined,
        achievements: updatedUser.achievements || undefined,
        parent_email: updatedUser.parent_email || undefined,
      };
      
      const totalMs = Date.now() - startTime;
      const response = {
        success: true,
        message: 'Onboarding profile updated successfully',
        profile: profile,
        data: { 
          userId: auth0UserId,
          name: userData.name,
          grade_level: userData.grade_level,
          updatedAt: new Date().toISOString()
        }
      };
      
      console.info('📝 [update-profile] ========== REQUEST COMPLETE ==========');
      console.info(`📝 [update-profile] Total time: ${totalMs}ms`);
      console.info('📝 [update-profile] FULL RESPONSE BEING SENT:', JSON.stringify(response, null, 2));
      
      return res.status(200).json(response);
    
    } else {
      // Create new user with onboarding data
      console.info('📝 [update-profile] Creating new user with onboarding data:', auth0UserId.substring(0, 8) + '...');
      
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{
          auth0_id: auth0UserId,
          email: decoded.email || '',
          avatar_url: decoded.picture || null,
          ...userData,
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();
      
      if (insertError) {
        console.error('📝 [update-profile] Error creating user:', insertError);
        throw insertError;
      }
      
      console.info('📝 [update-profile] New user created successfully with onboarding data');
      
      // Return new profile
      const profile = {
        user_id: auth0UserId,
        name: newUser.name || '',
        email: decoded.email || '',
        picture: newUser.avatar_url || undefined,
        grade_level: newUser.grade_level || undefined,
        interests: newUser.interests || undefined,
        achievements: newUser.achievements || undefined,
        parent_email: newUser.parent_email || undefined,
      };
      
      const totalMs = Date.now() - startTime;
      const response = {
        success: true,
        message: 'Onboarding profile created successfully',
        profile: profile,
        data: { 
          userId: auth0UserId,
          name: userData.name,
          grade_level: userData.grade_level,
          createdAt: new Date().toISOString()
        }
      };
      
      console.info('📝 [update-profile] ========== REQUEST COMPLETE ==========');
      console.info(`📝 [update-profile] Total time: ${totalMs}ms`);
      console.info('📝 [update-profile] FULL RESPONSE BEING SENT:', JSON.stringify(response, null, 2));
      
      return res.status(201).json(response);
    }
  } catch (error) {
    const totalMs = Date.now() - startTime;
    console.error('📝 [update-profile] ========== REQUEST ERROR ==========');
    console.error('📝 [update-profile] Onboarding profile update error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: totalMs
    });
    return res.status(500).json({ 
      error: 'Failed to update onboarding profile',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 