import { logStoryCall, flushApiLogger } from '../../lib/api-logger';
import { storyResponseSchema } from '../../lib/ai-schemas';
import { getStoryInstructions } from '../../lib/ai-instructions';
import { buildAIConfig } from '../../lib/ai-config';
import { 
  handleCORS, 
  processAIRequest, 
  normalizeAchievementTags, 
  createErrorResponse 
} from '../../lib/api-handler';

// Text truncation configuration
const TEXT_TRUNCATION = {
  MAX_TITLE_LENGTH: 100,
  MAX_CONTENT_LENGTH: 2000,
  MAX_CHARACTER_LENGTH: 50,
  MAX_SETTING_LENGTH: 100,
  MAX_MORAL_LENGTH: 200,
} as const;

/**
 * Truncate text to specified length with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Process the JSON response from story generation API
 */
function processStoryResponse(responseText: string, prompt: string, gradeLevel: number) {
  try {
    const jsonResponse = JSON.parse(responseText);
    
    if (jsonResponse.story) {
      const story = jsonResponse.story;
      return {
        prompt: prompt,
        gradeLevel: gradeLevel,
        title: truncateText(story.title, TEXT_TRUNCATION.MAX_TITLE_LENGTH),
        content: (story.content || []).map((paragraph: string) => 
          truncateText(paragraph, TEXT_TRUNCATION.MAX_CONTENT_LENGTH)
        ),
        characters: (story.characters || []).map((character: string) => 
          truncateText(character, TEXT_TRUNCATION.MAX_CHARACTER_LENGTH)
        ),
        setting: truncateText(story.setting || '', TEXT_TRUNCATION.MAX_SETTING_LENGTH),
        moral: truncateText(story.moral || '', TEXT_TRUNCATION.MAX_MORAL_LENGTH),
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
  const { prompt, gradeLevel = 3, userId } = req.body;
  
  // Validate required parameters
  if (!prompt) {
    console.info('❌ Missing story prompt');
    
    logStoryCall({
      userId,
      gradeLevel,
      prompt: prompt || 'unknown',
      responseTimeMs: Date.now() - startTime,
      success: false,
      error: 'BadRequest',
      model: 'gemini-2.5-flash',
    });
    await flushApiLogger();
    
    return res.status(400).json({ error: "Story prompt is required." });
  }

  try {
    console.info('📖 [story] Request received for prompt:', prompt);
    
    // Build system instructions
    const systemInstructions = getStoryInstructions(prompt, gradeLevel);
    
    // Build AI configuration
    const config = buildAIConfig(storyResponseSchema, systemInstructions);
    
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

    // Process AI request using centralized handler
    const { responseText, usageMetadata } = await processAIRequest(
      config, 
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
      model: 'gemini-2.5-flash',
    });
    await flushApiLogger();

    console.info('✅ [story] Successfully generated story for prompt:', prompt);
    
    return res.status(200).json(processedResponse);
    
  } catch (error: any) {
    // Log failed request
    logStoryCall({
      userId,
      gradeLevel,
      prompt,
      responseTimeMs: Date.now() - startTime,
      success: false,
      error: error.message || 'UnknownError',
      model: 'gemini-2.5-flash',
    });
    await flushApiLogger();

    // Create standardized error response
    const errorResponse = createErrorResponse(error, 'story', { 
      prompt: req.body?.prompt 
    });
    
    return res.status(errorResponse.status).json(errorResponse.body);
  }
}