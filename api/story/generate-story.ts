import { logStoryCall, flushApiLogger } from '../../lib/api-logger';
import { storyResponseSchema } from '../../lib/ai-schemas';
import { getStoryInstructions } from '../../lib/ai-instructions';
import { 
  handleCORS, 
  processAIRequest, 
  normalizeAchievementTags, 
  createErrorResponse 
} from '../../lib/api-handler';
import { verifySupabaseToken } from '../../lib/auth-supabase';
import { checkRateLimit } from '../../lib/rate-limit';
import { canGenerate } from '../../lib/subscription-gate';
import { incrementDailyUsage } from '../../lib/usage-daily';

/**
 * Process the JSON response from story generation API
 * No truncation applied - AI schema and instructions constrain output sizes appropriately
 */
function processStoryResponse(responseText: string, prompt: string, gradeLevel: number) {
  try {
    const jsonResponse = JSON.parse(responseText);
    
    if (jsonResponse.story) {
      const story = jsonResponse.story;
      return {
        prompt: prompt,
        gradeLevel: gradeLevel,
        title: story.title,
        content: story.content || [],
        characters: story.characters || [],
        setting: story.setting || '',
        moral: story.moral || '',
        tags: story.tags || story.requiredCategoryTags || [],
        timestamp: new Date().toISOString(),
        // Include normalized achievement tags
        requiredCategoryTags: story.requiredCategoryTags || [],
        optionalTags: story.optionalTags || []
      };
    } else {
      throw new Error('Invalid story JSON structure');
    }
  } catch (error) {
    console.error('Failed to parse story JSON response:', error);
    throw new Error(`Failed to generate story: Invalid response format. Please try again.`);
  }
}

export default async function handler(req: any, res: any) {
  // Handle CORS and validate request method
  if (!handleCORS(req, res)) return;

  const startTime = Date.now();
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Missing authorization token',
      userMessage: 'Please sign in again.',
    });
  }

  let decoded: any;
  try {
    decoded = await verifySupabaseToken(token);
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      userMessage: 'Session expired. Please sign in again.',
    });
  }

  const userId = decoded?.id || 'unknown';

  const gate = await canGenerate(userId, 'story');
  if (!gate.allowed) {
    return res.status(403).json({
      success: false,
      code: gate.reason,
      userMessage: gate.reason === 'daily_limit_reached'
        ? "You've reached your daily limit. Upgrade for unlimited access."
        : 'A subscription is required for this feature.',
    });
  }

  const { prompt, gradeLevel = 3, tags } = req.body;
  const contextTags = Array.isArray(tags) ? tags : [];
  
  console.log('[STORY API] Request received:', {
    userId,
    prompt,
    gradeLevel,
    tags,
    tagsType: typeof tags,
    tagsIsArray: Array.isArray(tags),
    contextTagsCount: contextTags.length,
    contextTags,
  });
  
  // Validate required parameters
  if (!prompt) {
    logStoryCall({
      userId,
      gradeLevel,
      prompt: prompt || 'unknown',
      responseTimeMs: Date.now() - startTime,
      success: false,
      error: 'BadRequest',
      model: 'unknown',
    });
    void flushApiLogger();
    
    return res.status(400).json({
      success: false,
      error: "Please provide a story prompt.",
      userMessage: "Please provide a story prompt.",
      prompt: prompt || null
    });
  }

  // Basic per-user rate limiting to reduce spamming
  const rate = checkRateLimit(`story:${userId}`, 8, 60 * 1000);
  if (!rate.allowed) {
    return res.status(429).json({
      success: false,
      error: "Too many requests",
      userMessage: "I'm writing lots of stories right now. Let's pause for a moment.",
      retryAfterMs: rate.retryAfterMs,
    });
  }

  try {
    // Build system instructions
    const systemInstructions = getStoryInstructions(prompt, gradeLevel, contextTags);
    
    // Create contents for AI request
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: `prompt = ${prompt}, grade ${gradeLevel}, age ${gradeLevel + 5}`,
          },
        ],
      },
    ];

    // Process AI request using centralized handler with retry and fallback
    const { responseText, usageMetadata, modelUsed, fallbackUsed } = await processAIRequest(
      storyResponseSchema,
      systemInstructions,
      contents,
      'story',
      prompt
    );
    
    // Process the story response
    const processedResponse = processStoryResponse(responseText, prompt, gradeLevel);
    
    // Normalize achievement tags
    normalizeAchievementTags(processedResponse);

    // Log successful request
    logStoryCall({
      userId,
      gradeLevel,
      prompt,
      responseText,
      responseTimeMs: Date.now() - startTime,
      success: true,
      usageMetadata,
      model: modelUsed,
    });
    void flushApiLogger();
    
    incrementDailyUsage(userId, 'story');

    return res.status(200).json({
      ...processedResponse,
      success: true
    });
    
  } catch (error: any) {
    // Log failed request
    logStoryCall({
      userId,
      gradeLevel,
      prompt,
      responseTimeMs: Date.now() - startTime,
      success: false,
      error: error.message || 'UnknownError',
      model: 'unknown',
    });
    void flushApiLogger();

    // Create standardized error response
    const errorResponse = createErrorResponse(error, 'story', { 
      prompt: req.body?.prompt 
    });
    
    return res.status(errorResponse.status).json(errorResponse.body);
  }
}