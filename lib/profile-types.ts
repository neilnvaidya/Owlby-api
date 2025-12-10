// Achievement type definition
export interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  earned: boolean;
  earned_at?: string; // ISO timestamp
  category: 'learning' | 'engagement' | 'milestone' | 'social' | 'special';
  difficulty: 'bronze' | 'silver' | 'gold' | 'platinum';
  points: number;
}

// User stats type definition
export interface UserStats {
  stars_earned: number;
  total_lessons: number;
  total_quizzes: number;
  streak_days: number;
  stories_created: number;
  chat_messages: number;
  topics_explored: number;
  quiz_correct_answers: number;
  quiz_total_answers: number;
  learning_minutes: number;
  favorite_subjects: string[];
  last_activity_at?: string; // ISO timestamp
}

// User preferences type definition
export interface UserPreferences {
  notifications_enabled: boolean;
  sound_effects_enabled: boolean;
  haptic_feedback_enabled: boolean;
  dark_mode_enabled: boolean;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  learning_reminders: boolean;
  reminder_time?: string; // HH:MM format
  safe_mode_enabled: boolean;
}

// Learning progress type definition
export interface LearningProgress {
  current_grade_level: number;
  completed_topics: string[];
  in_progress_topics: string[];
  mastered_skills: string[];
  areas_for_improvement: string[];
  learning_goals: string[];
  last_lesson_completed_at?: string; // ISO timestamp
}

// Comprehensive user profile type
export interface UserProfile {
  // Core identity
  user_id: string;
  auth_uid?: string;
  email: string;
  name: string;
  picture?: string;
  email_verified_at?: string | null;
  
  // Basic profile info
  age?: number;
  grade_level?: number;
  interests?: string[];
  parent_email?: string;
  
  // Achievements and stats
  achievements: Achievement[];
  stats: UserStats;
  preferences: UserPreferences;
  learning_progress: LearningProgress;
  
  // Metadata
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  last_login_at?: string; // ISO timestamp
  onboarding_completed: boolean;
  onboarding_completed_at?: string | null;
  profile_completed: boolean;
  
  // Analytics data from Supabase
  total_sessions: number;
  total_chat_messages: number;
  total_lessons_completed: number;
  total_stories_generated: number;
}

// Mock user data for development and testing
export const createMockUserProfile = (auth_uid: string, email: string, name: string): UserProfile => {
  const now = new Date().toISOString();
  
  return {
    user_id: auth_uid,
    auth_uid,
    email,
    name,
    picture: undefined,
    email_verified_at: now,
    age: 10,
    grade_level: 4,
    interests: ['space', 'animals', 'math', 'science', 'art'],
    parent_email: 'parent@example.com',
    
    achievements: [
      {
        id: 'first_question',
        icon: 'star',
        title: 'First Question',
        description: 'Asked your first question',
        earned: true,
        earned_at: now,
        category: 'milestone',
        difficulty: 'bronze',
        points: 10
      },
      {
        id: 'quick_learner',
        icon: 'medal',
        title: 'Quick Learner',
        description: 'Completed 5 lessons',
        earned: true,
        earned_at: now,
        category: 'learning',
        difficulty: 'silver',
        points: 25
      },
      {
        id: 'quiz_master',
        icon: 'trophy',
        title: 'Quiz Master',
        description: 'Scored 100% on a quiz',
        earned: false,
        category: 'learning',
        difficulty: 'gold',
        points: 50
      },
      {
        id: 'streak_champion',
        icon: 'flash',
        title: 'Streak Champion',
        description: '7 days in a row',
        earned: true,
        earned_at: now,
        category: 'engagement',
        difficulty: 'silver',
        points: 30
      },
      {
        id: 'knowledge_seeker',
        icon: 'school',
        title: 'Knowledge Seeker',
        description: 'Explored 10 topics',
        earned: false,
        category: 'learning',
        difficulty: 'gold',
        points: 40
      },
      {
        id: 'owlby_expert',
        icon: 'diamond',
        title: 'Owlby Expert',
        description: 'Unlock all features',
        earned: false,
        category: 'special',
        difficulty: 'platinum',
        points: 100
      }
    ],
    
    stats: {
      stars_earned: 127,
      total_lessons: 23,
      total_quizzes: 15,
      streak_days: 7,
      stories_created: 8,
      chat_messages: 142,
      topics_explored: 12,
      quiz_correct_answers: 89,
      quiz_total_answers: 95,
      learning_minutes: 320,
      favorite_subjects: ['Space', 'Animals', 'Math'],
      last_activity_at: now
    },
    
    preferences: {
      notifications_enabled: true,
      sound_effects_enabled: true,
      haptic_feedback_enabled: true,
      dark_mode_enabled: false,
      difficulty_level: 'intermediate',
      learning_reminders: true,
      reminder_time: '16:00',
      safe_mode_enabled: true
    },
    
    learning_progress: {
      current_grade_level: 4,
      completed_topics: ['Basic Math', 'Solar System', 'Animal Habitats'],
      in_progress_topics: ['Fractions', 'Weather Patterns'],
      mastered_skills: ['Addition', 'Subtraction', 'Planet Names'],
      areas_for_improvement: ['Multiplication', 'Division'],
      learning_goals: ['Master multiplication tables', 'Learn about ecosystems'],
      last_lesson_completed_at: now
    },
    
    created_at: now,
    updated_at: now,
    last_login_at: now,
    onboarding_completed: true,
    onboarding_completed_at: now,
    profile_completed: true,
    
    total_sessions: 45,
    total_chat_messages: 142,
    total_lessons_completed: 23,
    total_stories_generated: 8
  };
};

// Type for profile update requests
export interface ProfileUpdateRequest {
  name?: string;
  email?: string;
  age?: number;
  grade_level?: number;
  interests?: string[];
  parent_email?: string;
  achievements?: Achievement[];
  stats?: Partial<UserStats>;
  preferences?: Partial<UserPreferences>;
  learning_progress?: Partial<LearningProgress>;
  onboarding_completed?: boolean;
  profile_completed?: boolean;
}

// Type for comprehensive profile update (includes all fields for syncing)
export interface FullProfileUpdateRequest extends ProfileUpdateRequest {
  stats?: UserStats;
  preferences?: UserPreferences;
  learning_progress?: LearningProgress;
}

// Type for onboarding data
export interface OnboardingData {
  name: string;
  age: number;
  grade_level: number;
  interests: string[];
  parent_email?: string;
  learning_goals?: string[];
} 