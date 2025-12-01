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
  const startTime = Date.now();
  
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

  console.info('💬 [feedback] ========== REQUEST START ==========');
  console.info('💬 [feedback] REQUEST:', JSON.stringify({
    method: req.method,
    hasAuthHeader: !!req.headers.authorization,
    bodyKeys: req.body ? Object.keys(req.body) : []
  }, null, 2));

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

    console.info('💬 [feedback] REQUEST BODY:', JSON.stringify({
      feedback_type,
      category,
      ratings,
      text_responses: {
        ...text_responses,
        // Truncate long text for logging
        what_you_like: text_responses.what_you_like?.substring(0, 200),
        what_needs_improvement: text_responses.what_needs_improvement?.substring(0, 200),
        feature_suggestions: text_responses.feature_suggestions?.substring(0, 200),
        additional_comments: text_responses.additional_comments?.substring(0, 200)
      },
      context,
      is_anonymous
    }, null, 2));

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
        console.info('💬 [feedback] User authenticated:', {
          userId: user_id?.substring(0, 8) + '...'
        });
      } catch (error) {
        // If token is invalid, treat as anonymous feedback
        console.warn('💬 [feedback] Invalid token for feedback submission, treating as anonymous', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } else {
      console.info('💬 [feedback] Processing as anonymous feedback');
    }

    // Sanitize text inputs (prevent extremely long submissions)
    const sanitizeText = (text: string | undefined, maxLength: number = 1000) => {
      return text ? text.slice(0, maxLength).trim() : null;
    };

    // Prepare feedback data for database
    const feedbackData = {
      user_id: is_anonymous ? null : user_id,
      user_type: 'child',
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

    console.info('💬 [feedback] Prepared feedback data for DB:', JSON.stringify({
      ...feedbackData,
      // Truncate long text for logging
      what_you_like: feedbackData.what_you_like?.substring(0, 200),
      what_needs_improvement: feedbackData.what_needs_improvement?.substring(0, 200),
      feature_suggestions: feedbackData.feature_suggestions?.substring(0, 200),
      additional_comments: feedbackData.additional_comments?.substring(0, 200)
    }, null, 2));

    // Insert into Supabase
    const { data, error } = await supabase
      .from('feedback')
      .insert([feedbackData])
      .select()
      .single();

    if (error) {
      console.error('💬 [feedback] Database error inserting feedback:', error);
      return res.status(500).json({ 
        error: 'Failed to save feedback'
      });
    }

    const totalMs = Date.now() - startTime;
    const response = {
      success: true,
      message: 'Feedback submitted successfully',
      feedback_id: data.id,
      thank_you_message: feedback_type === 'bug_report' 
        ? 'Thank you for helping us improve Owlby! We\'ll look into this issue.'
        : 'Thank you for your feedback! It helps us make Owlby better for everyone.'
    };

    console.info('💬 [feedback] ========== REQUEST COMPLETE ==========');
    console.info(`💬 [feedback] Total time: ${totalMs}ms`);
    console.info('💬 [feedback] FULL RESPONSE BEING SENT:', JSON.stringify(response, null, 2));

    // Return success response
    return res.status(201).json(response);

  } catch (error) {
    const totalMs = Date.now() - startTime;
    console.error('💬 [feedback] ========== REQUEST ERROR ==========');
    console.error('💬 [feedback] Feedback submission error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: totalMs
    });
    return res.status(500).json({ 
      error: 'Internal server error'
    });
  }
} 