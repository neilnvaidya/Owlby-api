import { supabase } from '../../lib/supabase';
import { verifyToken } from '../../lib/auth';

export interface FeedbackSubmission {
  feedback_type: 'general' | 'bug_report' | 'feature_request' | 'learning_experience';
  category?: 'chat' | 'lessons' | 'navigation' | 'content' | 'safety' | 'other';
  ratings?: {
    overall_rating?: number;
    ease_of_use_rating?: number;
    content_quality_rating?: number;
    safety_comfort_rating?: number;
  };
  text_responses?: {
    what_you_like?: string;
    what_needs_improvement?: string;
    feature_suggestions?: string;
    learning_goals?: string;
    additional_comments?: string;
  };
  context: {
    child_age?: number;
    usage_frequency?: 'daily' | 'weekly' | 'monthly' | 'first_time';
    device_type: 'ios' | 'android' | 'web';
    app_version: string;
    session_context?: any;
  };
  contact_email?: string;
  is_anonymous?: boolean;
}

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      feedback_type,
      category,
      ratings = {},
      text_responses = {},
      context,
      contact_email,
      is_anonymous = false
    }: FeedbackSubmission = req.body;

    // Validate required fields
    if (!feedback_type || !context) {
      return res.status(400).json({ 
        error: 'Missing required fields: feedback_type and context' 
      });
    }

    // Validate feedback_type
    const validFeedbackTypes = ['general', 'bug_report', 'feature_request', 'learning_experience'];
    if (!validFeedbackTypes.includes(feedback_type)) {
      return res.status(400).json({ 
        error: 'Invalid feedback_type' 
      });
    }

    // Validate ratings (1-5 scale)
    const validateRating = (rating: number | undefined) => {
      return rating === undefined || (rating >= 1 && rating <= 5);
    };

    if (!validateRating(ratings.overall_rating) ||
        !validateRating(ratings.ease_of_use_rating) ||
        !validateRating(ratings.content_quality_rating) ||
        !validateRating(ratings.safety_comfort_rating)) {
      return res.status(400).json({ 
        error: 'Ratings must be between 1 and 5' 
      });
    }

    // Validate context fields
    const validDeviceTypes = ['ios', 'android', 'web'];
    const validUsageFrequencies = ['daily', 'weekly', 'monthly', 'first_time'];


    if (!validDeviceTypes.includes(context.device_type)) {
      return res.status(400).json({ 
        error: 'Invalid device_type. Must be: ios, android, or web' 
      });
    }

    if (context.usage_frequency && !validUsageFrequencies.includes(context.usage_frequency)) {
      return res.status(400).json({ 
        error: 'Invalid usage_frequency. Must be: daily, weekly, monthly, or first_time' 
      });
    }

    // Validate category
    const validCategories = ['chat', 'lessons', 'navigation', 'content', 'safety', 'other'];
    const validatedCategory = category && validCategories.includes(category) ? category : null;

    // Get user ID from token if provided
    let user_id = null;
    const authHeader = req.headers.authorization;
    if (authHeader && !is_anonymous) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const decoded = await verifyToken(token);
        user_id = decoded.sub;
      } catch (error) {
        // If token is invalid, treat as anonymous feedback
        console.warn('Invalid token for feedback submission, treating as anonymous');
      }
    }

    // Sanitize text inputs (prevent extremely long submissions)
    const sanitizeText = (text: string | undefined, maxLength: number = 1000) => {
      return text ? text.slice(0, maxLength).trim() : null;
    };

    // Prepare feedback data for database
    const feedbackData = {
      user_id: is_anonymous ? null : user_id,
      feedback_type,
      category: validatedCategory,
      
      // Ratings
      overall_rating: ratings.overall_rating || null,
      ease_of_use_rating: ratings.ease_of_use_rating || null,
      content_quality_rating: ratings.content_quality_rating || null,
      safety_comfort_rating: ratings.safety_comfort_rating || null,
      
      // Text responses
      what_you_like: sanitizeText(text_responses.what_you_like),
      what_needs_improvement: sanitizeText(text_responses.what_needs_improvement),
      feature_suggestions: sanitizeText(text_responses.feature_suggestions),
      learning_goals: sanitizeText(text_responses.learning_goals),
      additional_comments: sanitizeText(text_responses.additional_comments),
      
      // Context
      child_age: context.child_age || null,
      usage_frequency: context.usage_frequency || null,
      device_type: context.device_type,
      app_version: context.app_version,
      session_context: context.session_context || null,
      
      // Metadata
      is_anonymous,
      contact_email: is_anonymous ? null : sanitizeText(contact_email, 255),
      created_at: new Date().toISOString()
    };

    // Insert into Supabase
    const { data, error } = await supabase
      .from('feedback')
      .insert([feedbackData])
      .select()
      .single();

    if (error) {
      console.error('Database error inserting feedback:', error);
      return res.status(500).json({ 
        error: 'Failed to save feedback'
      });
    }

    // Return success response
    return res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      feedback_id: data.id,
      thank_you_message: feedback_type === 'bug_report' 
        ? 'Thank you for helping us improve Owlby! We\'ll look into this issue.'
        : 'Thank you for your feedback! It helps us make Owlby better for everyone.'
    });

  } catch (error) {
    console.error('Feedback submission error:', error);
    return res.status(500).json({ 
      error: 'Internal server error'
    });
  }
} 