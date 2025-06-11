-- Owlby Feedback Table Creation Script
-- Run this in your Supabase SQL Editor

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

-- Insert a test feedback entry to verify the table works
INSERT INTO feedback (
  feedback_type,
  category,
  overall_rating,
  what_you_like,
  user_type,
  device_type,
  app_version,
  is_anonymous
) VALUES (
  'general',
  'other',
  5,
  'Test feedback submission - table created successfully!',
  'child',
  'ios',
  '1.0.0',
  true
);

-- Verify the table was created correctly
SELECT * FROM feedback WHERE feedback_type = 'general' LIMIT 1; 