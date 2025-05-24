// User profile type for MVP
export interface UserProfile {
  user_id: string;
  name: string;
  email: string;
  picture?: string;
  grade_level?: number;
  interests?: string[];
  achievements?: string[];
  parent_email?: string;
} 