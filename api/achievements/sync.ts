import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/supabase';
import { verifyToken } from '../../lib/auth';

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
  const startTime = Date.now();
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  console.info('🏆 [achievements] ========== REQUEST START ==========');
  console.info('🏆 [achievements] REQUEST:', JSON.stringify({
    method: req.method,
    url: req.url,
    hasAuthHeader: !!req.headers.authorization,
    bodyKeys: req.body ? Object.keys(req.body) : []
  }, null, 2));

  try {
    // Authenticate user
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('🏆 [achievements] No valid authorization header', { 
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
      user = await verifyToken(token);
      console.info('🏆 [achievements] User authenticated:', {
        userId: user.sub?.substring(0, 8) + '...',
        email: user.email
      });
    } catch (error) {
      console.warn('🏆 [achievements] Token verification failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        method: req.method,
        url: req.url
      });
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid authentication token' 
      });
    }

    console.info('🏆 [achievements] Achievement sync request', {
      userId: user.sub?.substring(0, 8) + '...',
      method: req.method,
    });

    let result;
    switch (req.method) {
      case 'GET':
        result = await handleGetAchievements(req, res, user.sub);
        break;
      case 'POST':
        console.info('🏆 [achievements] REQUEST BODY:', JSON.stringify(req.body, null, 2));
        result = await handleSyncAchievements(req, res, user.sub, user);
        break;
      default:
        result = res.status(405).json({ 
          success: false, 
          error: 'Method not allowed' 
        });
    }
    
    const totalMs = Date.now() - startTime;
    console.info('🏆 [achievements] ========== REQUEST COMPLETE ==========');
    console.info(`🏆 [achievements] Total time: ${totalMs}ms`);
    
    return result;
  } catch (error) {
    const totalMs = Date.now() - startTime;
    console.error('🏆 [achievements] ========== REQUEST ERROR ==========');
    console.error('🏆 [achievements] Error:', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      method: req.method,
      url: req.url,
      duration: totalMs
    });
    
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}

async function handleGetAchievements(req: VercelRequest, res: VercelResponse, userId: string) {
  try {
    console.info('🏆 [achievements] GET: Fetching achievement data for user');
    
    // Get user achievement data from database
    const { data: userData, error } = await supabase
      .from('users')
      .select('achievements, stats, updated_at')
      .eq('auth0_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // User not found, return empty achievement data
        console.info('🏆 [achievements] GET: User not found, returning empty achievements', { 
          userId: userId.substring(0, 8) + '...' 
        });
        return res.status(200).json({
          success: true,
          data: null,
          message: 'No achievement data found'
        });
      }
      console.error('🏆 [achievements] GET: Database error:', error);
      throw error;
    }

    console.info('🏆 [achievements] GET: Raw user data from DB:', JSON.stringify({
      hasAchievements: !!userData.achievements,
      hasStats: !!userData.stats,
      updatedAt: userData.updated_at
    }, null, 2));

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

    console.info('🏆 [achievements] GET: Achievement data retrieved successfully', {
      userId: userId.substring(0, 8) + '...',
      totalStars: achievementData.starRepository.totalStars,
      unclaimedStars: achievementData.starRepository.unclaimedStars,
    });
    
    console.info('🏆 [achievements] GET: FULL RESPONSE BEING SENT:', JSON.stringify({
      success: true,
      data: achievementData
    }, null, 2));

    return res.status(200).json({
      success: true,
      data: achievementData
    });

  } catch (error) {
    console.error('🏆 [achievements] GET: Error retrieving achievement data', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: userId.substring(0, 8) + '...'
    });
    throw error;
  }
}

async function handleSyncAchievements(req: VercelRequest, res: VercelResponse, userId: string, user: any) {
  try {
    console.info('🏆 [achievements] POST: Starting achievement sync');
    const achievementData = req.body as AchievementData;

    console.info('🏆 [achievements] POST: Received achievement data:', JSON.stringify({
      totalStars: achievementData?.starRepository?.totalStars,
      unclaimedStars: achievementData?.starRepository?.unclaimedStars,
      badgeProgressKeys: achievementData?.starRepository?.badgeProgress ? Object.keys(achievementData.starRepository.badgeProgress) : [],
      starHistoryCount: achievementData?.starRepository?.starHistory?.length || 0,
      pendingRewardsCount: achievementData?.starRepository?.pendingRewards?.length || 0
    }, null, 2));

    if (!achievementData || !achievementData.starRepository) {
      console.warn('🏆 [achievements] POST: Invalid achievement data provided');
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

    console.info('🏆 [achievements] POST: Prepared DB data:', JSON.stringify({
      achievementDbData: {
        totalStars: achievementDbData.totalStars,
        unclaimedStars: achievementDbData.unclaimedStars,
        badgeProgressKeys: Object.keys(achievementDbData.badgeProgress || {}),
        starHistoryCount: achievementDbData.starHistory?.length || 0
      },
      statsDbData
    }, null, 2));

    // Update user achievements and stats in database
    const { data, error } = await supabase
      .from('users')
      .upsert({
        auth0_id: userId,
        email: user.email || '', // Include email from JWT token
        achievements: achievementDbData,
        stats: statsDbData,
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { 
        onConflict: 'auth0_id',
        ignoreDuplicates: false 
      })
      .select('id, auth0_id, updated_at')
      .single();

    if (error) {
      console.error('🏆 [achievements] POST: Database error:', error);
      throw error;
    }

    console.info('🏆 [achievements] POST: Achievement data synced successfully', {
      userId: userId.substring(0, 8) + '...',
      totalStars: achievementData.starRepository.totalStars,
      unclaimedStars: achievementData.starRepository.unclaimedStars,
      syncTime: new Date().toISOString(),
    });

    const response = {
      success: true,
      data: {
        syncTime: data.updated_at,
        message: 'Achievement data synced successfully'
      }
    };
    
    console.info('🏆 [achievements] POST: FULL RESPONSE BEING SENT:', JSON.stringify(response, null, 2));

    return res.status(200).json(response);

  } catch (error) {
    console.error('🏆 [achievements] POST: Error syncing achievement data', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: userId.substring(0, 8) + '...'
    });
    throw error;
  }
} 