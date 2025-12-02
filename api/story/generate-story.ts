import { logStoryCall, flushApiLogger } from '../../lib/api-logger';
import { storyResponseSchema } from '../../lib/ai-schemas';
import { getStoryInstructions } from '../../lib/ai-instructions';
import { 
  handleCORS, 
  processAIRequest, 
  normalizeAchievementTags, 
  createErrorResponse 
} from '../../lib/api-handler';

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
      model: 'unknown',
    });
    await flushApiLogger();
    
    return res.status(400).json({ error: "Story prompt is required." });
  }

  try {
    console.info('📖 [story] Request received for prompt:', prompt);
    
    // Build system instructions
    const systemInstructions = getStoryInstructions(prompt, gradeLevel);
    
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
    
    if (fallbackUsed) {
      console.info(`⚠️ [story] Fallback model used: ${modelUsed}`);
    }
    
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
      model: 'unknown',
    });
    await flushApiLogger();

    // Create standardized error response
    const errorResponse = createErrorResponse(error, 'story', { 
      prompt: req.body?.prompt 
    });
    
    return res.status(errorResponse.status).json(errorResponse.body);
  }
}