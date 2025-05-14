// User profile type for MVP (Auth0 user info only)
export interface UserProfile {
  user_id: string;
  name: string;
  email: string;
  picture?: string;
} 