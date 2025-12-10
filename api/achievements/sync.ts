import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/supabase';
import { verifySupabaseToken } from '../../lib/auth-supabase';

export interface AchievementData {
  starRepository: {
    totalStars: number;
    unclaimedStars: number;
    badgeProgress: Record<string, {
      currentLevel: string;
      starsInCurrentLevel: number;
      totalStarsEarned: number;
      lastStarEarned: string | null;
    }>;
    starHistory: Array<{
      id: string;
      amount: number;
      source: string;
      timestamp: string;
      claimed: boolean;
      badgeCategory?: string;
    }>;
    pendingRewards: Array<{
      id: string;
      type: string;
      badgeCategory?: string;
      newLevel?: string;
      starAmount: number;
      earnedAt: string;
      priority: string;
    }>;
    lastClaimTime: string | null;
  };
  consistencyMetrics: {
    dailyLoginStreak: number;
    lastLoginDate: string | null;
    weeklyLearningGoal: number;
    weeklyProgress: number;
  };
  sessionStats: {
    totalInteractions: number;
    sessionDuration: number;
    chatMessages: number;
    lessonsStarted: number;
    lessonsCompleted: number;
    storiesOpened: number;
    storiesRead: number;
    quizzesStarted: number;
    quizzesCompleted: number;
    averageTimePerStory: number;
    averageTimePerLesson: number;
    averageQuizScore: number;
  };
  lastSyncTime: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Authenticate user
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('Achievements sync: No valid authorization header', { 
        method: req.method,
        url: req.url
      });
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }

    const token = authHeader.split(' ')[1];
    let user;
    try {
    user = await verifySupabaseToken(token);
    } catch (error) {
      console.warn('Achievements sync: Token verification failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        method: req.method,
        url: req.url
      });
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid authentication token' 
      });
    }

    console.log('Achievement sync request', {
      userId: user.id,
      method: req.method,
    });

    switch (req.method) {
      case 'GET':
        return handleGetAchievements(req, res, user.id);
      case 'POST':
        return handleSyncAchievements(req, res, user.id, user);
      default:
        return res.status(405).json({ 
          success: false, 
          error: 'Method not allowed' 
        });
    }
  } catch (error) {
    console.error('Achievement sync error', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      method: req.method,
      url: req.url
    });
    
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}

async function handleGetAchievements(req: VercelRequest, res: VercelResponse, userId: string) {
  try {
    // Get user achievement data from database
    const { data: userData, error } = await supabase
      .from('users')
      .select('achievements, stats, updated_at')
        .eq('auth_uid', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // User not found, return empty achievement data
        console.log('User not found, returning empty achievements', { userId });
        return res.status(200).json({
          success: true,
          data: null,
          message: 'No achievement data found'
        });
      }
      throw error;
    }

    // Parse achievement data
    const achievementData: AchievementData = {
      starRepository: {
        totalStars: userData.achievements?.totalStars || 0,
        unclaimedStars: userData.achievements?.unclaimedStars || 0,
        badgeProgress: userData.achievements?.badgeProgress || {},
        starHistory: userData.achievements?.starHistory || [],
        pendingRewards: userData.achievements?.pendingRewards || [],
        lastClaimTime: userData.achievements?.lastClaimTime || null,
      },
      consistencyMetrics: {
        dailyLoginStreak: userData.achievements?.consistencyMetrics?.dailyLoginStreak || 0,
        lastLoginDate: userData.achievements?.consistencyMetrics?.lastLoginDate || null,
        weeklyLearningGoal: userData.achievements?.consistencyMetrics?.weeklyLearningGoal || 0,
        weeklyProgress: userData.achievements?.consistencyMetrics?.weeklyProgress || 0,
      },
      sessionStats: {
        totalInteractions: userData.stats?.totalInteractions || 0,
        sessionDuration: userData.stats?.sessionDuration || 0,
        chatMessages: userData.stats?.chat_messages || 0,
        lessonsStarted: userData.stats?.lessonsStarted || 0,
        lessonsCompleted: userData.stats?.total_lessons || 0,
        storiesOpened: userData.stats?.storiesOpened || 0,
        storiesRead: userData.stats?.stories_created || 0,
        quizzesStarted: userData.stats?.quizzesStarted || 0,
        quizzesCompleted: userData.stats?.total_quizzes || 0,
        averageTimePerStory: userData.stats?.averageTimePerStory || 0,
        averageTimePerLesson: userData.stats?.averageTimePerLesson || 0,
        averageQuizScore: userData.stats?.averageQuizScore || 0,
      },
      lastSyncTime: userData.updated_at || new Date().toISOString(),
    };

    console.log('Achievement data retrieved successfully', {
      userId,
      totalStars: achievementData.starRepository.totalStars,
      unclaimedStars: achievementData.starRepository.unclaimedStars,
    });

    return res.status(200).json({
      success: true,
      data: achievementData
    });

  } catch (error) {
    console.error('Error retrieving achievement data', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId
    });
    throw error;
  }
}

async function handleSyncAchievements(req: VercelRequest, res: VercelResponse, userId: string, user: any) {
  try {
    const achievementData = req.body as AchievementData;

    if (!achievementData || !achievementData.starRepository) {
      return res.status(400).json({
        success: false,
        error: 'Invalid achievement data provided'
      });
    }

    // Prepare data for database update
    const achievementDbData = {
      totalStars: achievementData.starRepository.totalStars,
      unclaimedStars: achievementData.starRepository.unclaimedStars,
      badgeProgress: achievementData.starRepository.badgeProgress,
      starHistory: achievementData.starRepository.starHistory,
      pendingRewards: achievementData.starRepository.pendingRewards,
      lastClaimTime: achievementData.starRepository.lastClaimTime,
      consistencyMetrics: achievementData.consistencyMetrics,
      lastSyncTime: new Date().toISOString(),
    };

    const statsDbData = {
      stars_earned: achievementData.starRepository.totalStars,
      total_lessons: achievementData.sessionStats.lessonsCompleted,
      total_quizzes: achievementData.sessionStats.quizzesCompleted,
      chat_messages: achievementData.sessionStats.chatMessages,
      stories_created: achievementData.sessionStats.storiesRead,
      totalInteractions: achievementData.sessionStats.totalInteractions,
      sessionDuration: achievementData.sessionStats.sessionDuration,
      lessonsStarted: achievementData.sessionStats.lessonsStarted,
      storiesOpened: achievementData.sessionStats.storiesOpened,
      quizzesStarted: achievementData.sessionStats.quizzesStarted,
      averageTimePerStory: achievementData.sessionStats.averageTimePerStory,
      averageTimePerLesson: achievementData.sessionStats.averageTimePerLesson,
      averageQuizScore: achievementData.sessionStats.averageQuizScore,
      last_activity_at: new Date().toISOString(),
    };

    // Update user achievements and stats in database
    const { data, error } = await supabase
      .from('users')
      .upsert({
        auth_uid: userId,
        email: user.email || '', // Include email from JWT token
        achievements: achievementDbData,
        stats: statsDbData,
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { 
        onConflict: 'auth_uid',
        ignoreDuplicates: false 
      })
      .select('id, auth_uid, updated_at')
      .single();

    if (error) {
      throw error;
    }

    console.log('Achievement data synced successfully', {
      userId,
      totalStars: achievementData.starRepository.totalStars,
      unclaimedStars: achievementData.starRepository.unclaimedStars,
      syncTime: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      data: {
        syncTime: data.updated_at,
        message: 'Achievement data synced successfully'
      }
    });

  } catch (error) {
    console.error('Error syncing achievement data', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId
    });
    throw error;
  }
} 