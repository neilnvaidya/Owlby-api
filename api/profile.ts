import type { VercelRequest, VercelResponse } from '@vercel/node';
import { UserProfile, ProfileUpdateRequest, createMockUserProfile } from '../lib/profile-types';
import { supabase } from '../lib/supabase';
import { verifySupabaseToken } from '../lib/auth-supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Missing or invalid token' });
    }

    const user = await verifySupabaseToken(token);
    const authUid = user.id;

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        return await getProfile(authUid, user, res);
      case 'POST':
        return await updateProfile(authUid, user, req.body, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Profile API error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

// GET profile handler
async function getProfile(authUid: string, decoded: any, res: VercelResponse) {
  try {
    console.log('Getting profile for user:', authUid);
    
    // Check if user exists in database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_uid', authUid)
      .single();
    
    if (userError && userError.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Supabase error getting user:', userError);
      throw userError;
    }
    
    // If user exists in database, return comprehensive profile
    if (userData) {
      console.log('User found in database, building comprehensive profile');
      
      const profile: UserProfile = {
        // Core identity
        user_id: authUid,
        auth_uid: authUid,
          auth_uid: authUid,
        email: decoded.email || userData.email || '',
        name: userData.name || decoded.name || '',
        picture: userData.avatar_url || decoded.picture || undefined,
        email_verified_at: userData.email_verified_at || null,
        
        // Basic profile info
        age: userData.age || undefined,
        grade_level: userData.grade_level || undefined,
        interests: userData.interests || [],
        parent_email: userData.parent_email || undefined,
        
        // Complex data from JSONB fields
        achievements: userData.achievements || [],
        stats: userData.stats || {
          stars_earned: 0,
          total_lessons: 0,
          total_quizzes: 0,
          streak_days: 0,
          stories_created: 0,
          chat_messages: 0,
          topics_explored: 0,
          quiz_correct_answers: 0,
          quiz_total_answers: 0,
          learning_minutes: 0,
          favorite_subjects: [],
          last_activity_at: new Date().toISOString()
        },
        preferences: userData.preferences || {
          notifications_enabled: true,
          sound_effects_enabled: true,
          haptic_feedback_enabled: true,
          dark_mode_enabled: false,
          difficulty_level: 'intermediate',
          learning_reminders: true,
          safe_mode_enabled: true
        },
        learning_progress: userData.learning_progress || {
          current_grade_level: userData.grade_level || 1,
          completed_topics: [],
          in_progress_topics: [],
          mastered_skills: [],
          areas_for_improvement: [],
          learning_goals: []
        },
        
        // Metadata
        created_at: userData.created_at || new Date().toISOString(),
        updated_at: userData.updated_at || new Date().toISOString(),
        last_login_at: userData.last_login_at || undefined,
        onboarding_completed: userData.onboarding_completed || false,
        onboarding_completed_at: userData.onboarding_completed_at || null,
        profile_completed: userData.profile_completed || false,
        
        // Analytics data
        total_sessions: userData.total_sessions || 0,
        total_chat_messages: userData.total_chat_messages || 0,
        total_lessons_completed: userData.total_lessons_completed || 0,
        total_stories_generated: userData.total_stories_generated || 0,
      };
      
      console.log('Returning comprehensive profile with', profile.achievements.length, 'achievements');
      return res.status(200).json(profile);
    }
    
    // If user doesn't exist yet, return null to indicate they need onboarding
    return res.status(404).json({ 
      error: 'User profile not found',
      needsOnboarding: true 
    });
    
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ error: 'Failed to get user profile' });
  }
}

// POST profile update handler
async function updateProfile(authUid: string, decoded: any, updateData: ProfileUpdateRequest, res: VercelResponse) {
  try {
    // Log keys only to avoid PII
    console.info('Updating profile fields:', Object.keys(updateData || {}));
    
    // Check if user exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_uid', authUid)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing user:', checkError);
      throw checkError;
    }
    
    // Validate and prepare update data
    const validatedData: any = {};
    
    // Basic fields
    if (updateData.name) validatedData.name = String(updateData.name).slice(0, 100);
    if (updateData.email) {
      validatedData.email = String(updateData.email).slice(0, 255);
      // Do not log email values
    }
    if (updateData.parent_email) validatedData.parent_email = String(updateData.parent_email).slice(0, 255);
    if (typeof updateData.age === 'number') validatedData.age = Math.min(Math.max(5, updateData.age), 18);
    if (typeof updateData.grade_level === 'number') validatedData.grade_level = Math.min(Math.max(0, updateData.grade_level), 12);
    if (Array.isArray(updateData.interests)) validatedData.interests = updateData.interests.map(String).slice(0, 20);
    
    // Profile completion flags
    if (typeof updateData.onboarding_completed === 'boolean') {
      validatedData.onboarding_completed = updateData.onboarding_completed;
      if (updateData.onboarding_completed) {
        validatedData.onboarding_completed_at = new Date().toISOString();
      }
    }
    if (typeof updateData.profile_completed === 'boolean') validatedData.profile_completed = updateData.profile_completed;
    
    // JSONB fields - merge with existing data
    if (existingUser) {
      // Merge achievements
      if (updateData.achievements) {
        validatedData.achievements = updateData.achievements;
      }
      
      // Merge stats
      if (updateData.stats) {
        const existingStats = existingUser.stats || {};
        validatedData.stats = { ...existingStats, ...updateData.stats };
      }
      
      // Merge preferences
      if (updateData.preferences) {
        const existingPreferences = existingUser.preferences || {};
        validatedData.preferences = { ...existingPreferences, ...updateData.preferences };
      }
      
      // Merge learning progress
      if (updateData.learning_progress) {
        const existingProgress = existingUser.learning_progress || {};
        validatedData.learning_progress = { ...existingProgress, ...updateData.learning_progress };
      }
    } else {
      // For new users, set the JSONB fields directly
      if (updateData.achievements) validatedData.achievements = updateData.achievements;
      if (updateData.stats) validatedData.stats = updateData.stats;
      if (updateData.preferences) validatedData.preferences = updateData.preferences;
      if (updateData.learning_progress) validatedData.learning_progress = updateData.learning_progress;
    }
    
    // Update last_login_at when profile is updated
    validatedData.last_login_at = new Date().toISOString();
    
    // Update or insert user record
    if (existingUser) {
      console.info('Updating existing user');
      // Update existing user
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(validatedData)
        .eq('auth_uid', authUid)
        .select()
        .single();
      
      if (updateError) {
        console.error('Error updating user:', updateError);
        throw updateError;
      }
      
      // Return updated comprehensive profile
      const profile: UserProfile = buildProfileFromDbData(updatedUser, decoded);
      console.info('User updated successfully');
      return res.status(200).json(profile);
      
    } else {
      console.info('Creating new user');
      // Insert new user
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{
          auth_uid: authUid,
          email: validatedData.email || decoded.email || '',
          avatar_url: decoded.picture || null,
          email_verified_at: null,
          ...validatedData,
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();
      
      if (insertError) {
        console.error('Error creating user:', insertError);
        throw insertError;
      }
      
      // Return new comprehensive profile
      const profile: UserProfile = buildProfileFromDbData(newUser, decoded);
      console.info('New user created successfully');
      return res.status(200).json(profile);
    }
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
}

// Helper function to build comprehensive profile from database data
function buildProfileFromDbData(userData: any, decoded: any): UserProfile {
  return {
    // Core identity
    user_id: userData.auth_uid,
    auth_uid: userData.auth_uid,
    email: decoded.email || userData.email || '',
    name: userData.name || decoded.name || '',
    picture: userData.avatar_url || decoded.picture || undefined,
    email_verified_at: userData.email_verified_at || null,
    
    // Basic profile info
    age: userData.age || undefined,
    grade_level: userData.grade_level || undefined,
    interests: userData.interests || [],
    parent_email: userData.parent_email || undefined,
    
    // Complex data from JSONB fields
    achievements: userData.achievements || [],
    stats: userData.stats || {
      stars_earned: 0,
      total_lessons: 0,
      total_quizzes: 0,
      streak_days: 0,
      stories_created: 0,
      chat_messages: 0,
      topics_explored: 0,
      quiz_correct_answers: 0,
      quiz_total_answers: 0,
      learning_minutes: 0,
      favorite_subjects: [],
      last_activity_at: new Date().toISOString()
    },
    preferences: userData.preferences || {
      notifications_enabled: true,
      sound_effects_enabled: true,
      haptic_feedback_enabled: true,
      dark_mode_enabled: false,
      difficulty_level: 'intermediate',
      learning_reminders: true,
      safe_mode_enabled: true
    },
    learning_progress: userData.learning_progress || {
      current_grade_level: userData.grade_level || 1,
      completed_topics: [],
      in_progress_topics: [],
      mastered_skills: [],
      areas_for_improvement: [],
      learning_goals: []
    },
    
    // Metadata
    created_at: userData.created_at || new Date().toISOString(),
    updated_at: userData.updated_at || new Date().toISOString(),
    last_login_at: userData.last_login_at || undefined,
    onboarding_completed: userData.onboarding_completed || false,
    onboarding_completed_at: userData.onboarding_completed_at || null,
    profile_completed: userData.profile_completed || false,
    
    // Analytics data
    total_sessions: userData.total_sessions || 0,
    total_chat_messages: userData.total_chat_messages || 0,
    total_lessons_completed: userData.total_lessons_completed || 0,
    total_stories_generated: userData.total_stories_generated || 0,
  };
} 