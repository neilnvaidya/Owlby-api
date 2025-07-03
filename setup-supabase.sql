-- Owlby Database Schema Setup Script
-- Run this in your Supabase SQL Editor

-- ===============================
-- USER PROFILES TABLE
-- ===============================

-- Create users table for Owlby profile data
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  auth0_id TEXT UNIQUE NOT NULL,  -- Auth0 user ID (e.g., "auth0|123456" or "google-oauth2|123456")
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  
  -- Owlby-specific onboarding data
  grade_level INTEGER CHECK (grade_level >= 0 AND grade_level <= 12),
  interests TEXT[],  -- Array of interests
  achievements TEXT[],  -- Array of achievements
  parent_email TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP,
  
  -- Analytics data
  total_sessions INTEGER DEFAULT 0,
  total_chat_messages INTEGER DEFAULT 0,
  total_lessons_completed INTEGER DEFAULT 0,
  total_stories_generated INTEGER DEFAULT 0
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_auth0_id ON users(auth0_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_grade_level ON users(grade_level);

-- Add RLS (Row Level Security) policies for users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid()::text = auth0_id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid()::text = auth0_id);

-- Policy: Service role can manage all users (for API operations)
CREATE POLICY "Service role can manage users" ON users
  FOR ALL USING (auth.role() = 'service_role');

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at when users table is modified
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ===============================
-- FEEDBACK TABLE
-- ===============================

-- Create feedback table
CREATE TABLE feedback (
  id SERIAL PRIMARY KEY,
  user_id TEXT,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('general', 'bug_report', 'feature_request', 'learning_experience')),
  category TEXT CHECK (category IN ('chat', 'lessons', 'navigation', 'content', 'safety', 'other')),
  
  -- Ratings (1-5 scale)
  overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
  ease_of_use_rating INTEGER CHECK (ease_of_use_rating >= 1 AND ease_of_use_rating <= 5),
  content_quality_rating INTEGER CHECK (content_quality_rating >= 1 AND content_quality_rating <= 5),
  safety_comfort_rating INTEGER CHECK (safety_comfort_rating >= 1 AND safety_comfort_rating <= 5),
  
  -- Text responses
  what_you_like TEXT,
  what_needs_improvement TEXT,
  feature_suggestions TEXT,
  learning_goals TEXT,
  additional_comments TEXT,
  
  -- User context
  user_type TEXT NOT NULL CHECK (user_type IN ('child', 'parent', 'teacher')),
  child_age INTEGER,
  usage_frequency TEXT CHECK (usage_frequency IN ('daily', 'weekly', 'monthly', 'first_time')),
  device_type TEXT NOT NULL CHECK (device_type IN ('ios', 'android', 'web')),
  app_version TEXT NOT NULL,
  session_context JSONB,
  
  -- Privacy and contact
  is_anonymous BOOLEAN DEFAULT FALSE,
  contact_email TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX idx_feedback_user_id ON feedback(user_id);
CREATE INDEX idx_feedback_type ON feedback(feedback_type);
CREATE INDEX idx_feedback_category ON feedback(category);

-- Add RLS (Row Level Security) policies
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own feedback (if not anonymous)
CREATE POLICY "Users can view own feedback" ON feedback
  FOR SELECT USING (auth.uid()::text = user_id AND NOT is_anonymous);

-- Policy: Anyone can insert feedback (for anonymous submissions)
CREATE POLICY "Anyone can submit feedback" ON feedback
  FOR INSERT WITH CHECK (true);

-- Policy: Only service role can view all feedback (for admin/analytics)
CREATE POLICY "Service role can view all feedback" ON feedback
  FOR ALL USING (auth.role() = 'service_role');

-- ===============================
-- DATA RELATIONSHIPS & SAMPLE DATA
-- ===============================

-- Add foreign key relationship between feedback and users (optional, allows orphaned feedback)
-- This is optional to allow anonymous feedback that doesn't link to a user
ALTER TABLE feedback 
  ADD CONSTRAINT fk_feedback_user 
  FOREIGN KEY (user_id) 
  REFERENCES users(auth0_id) 
  ON DELETE SET NULL;  -- If user is deleted, keep feedback but set user_id to null

-- Insert sample user to test the users table
INSERT INTO users (
  auth0_id,
  email,
  name,
  grade_level,
  interests,
  parent_email
) VALUES (
  'auth0|test123456',
  'test@owlby.com',
  'Test Student',
  3,
  ARRAY['space', 'math', 'animals'],
  'parent@owlby.com'
) ON CONFLICT (auth0_id) DO NOTHING;  -- Avoid duplicates if script is run multiple times

-- Insert a test feedback entry to verify the tables work together
INSERT INTO feedback (
  user_id,
  feedback_type,
  category,
  overall_rating,
  what_you_like,
  user_type,
  device_type,
  app_version,
  is_anonymous
) VALUES (
  'auth0|test123456',
  'general',
  'other',
  5,
  'Test feedback submission - database schema created successfully!',
  'child',
  'ios',
  '1.0.0',
  false
) ON CONFLICT DO NOTHING;

-- ===============================
-- VERIFICATION QUERIES
-- ===============================

-- Verify the users table was created correctly
SELECT 'Users table verification:' as status;
SELECT auth0_id, email, name, grade_level, array_length(interests, 1) as interest_count
FROM users WHERE auth0_id = 'auth0|test123456';

-- Verify the feedback table relationship works
SELECT 'Feedback-User relationship verification:' as status;
SELECT f.feedback_type, f.overall_rating, u.name as user_name, u.grade_level
FROM feedback f 
LEFT JOIN users u ON f.user_id = u.auth0_id 
WHERE f.user_id = 'auth0|test123456'
LIMIT 1;

-- Show table structure summary
SELECT 'Database schema summary:' as status;
SELECT 
  schemaname,
  tablename,
  (SELECT count(*) FROM information_schema.columns WHERE table_name = tablename) as column_count
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'feedback')
ORDER BY tablename; 