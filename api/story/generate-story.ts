import { logStoryCall, flushApiLogger } from '../../lib/api-logger';
import { storyResponseSchema } from '../../lib/ai-schemas';
import { getStoryInstructions } from '../../lib/ai-instructions';
import { buildAIConfig, MODEL_NAME } from '../../lib/ai-config';
import { 
  handleCORS, 
  processAIRequest, 
  normalizeAchievementTags, 
  createErrorResponse 
} from '../../lib/api-handler';

/**
 * Process the JSON response from story generation API
 * Handles truncated or malformed JSON gracefully
 */
function processStoryResponse(responseText: string, prompt: string, gradeLevel: number) {
  try {
    // Log the raw response for debugging
    if (process.env.NODE_ENV === 'development') {
      console.debug('[story] Raw response length:', responseText.length);
      console.debug('[story] Raw response preview:', responseText.slice(0, 200));
    }
    
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
  } catch (error: any) {
    // Log the full response when parsing fails for debugging
    console.error('❌ [story] Failed to parse JSON response');
    console.error('❌ [story] Error:', error.message);
    console.error('❌ [story] Response length:', responseText.length);
    console.error('❌ [story] Response text (first 500 chars):', responseText.slice(0, 500));
    console.error('❌ [story] Response text (last 200 chars):', responseText.slice(-200));
    
    // Try to repair truncated JSON
    const jsonMatch = responseText.match(/\{[\s\S]*/);
    if (jsonMatch) {
      try {
        let repairedJson = jsonMatch[0];
        
        // Close unclosed strings
        const openQuotes = (repairedJson.match(/"/g) || []).length;
        if (openQuotes % 2 !== 0) {
          repairedJson = repairedJson.replace(/"([^"]*)$/, '"$1"');
        }
        
        // Try to close the JSON object
        const openBraces = (repairedJson.match(/\{/g) || []).length;
        const closeBraces = (repairedJson.match(/\}/g) || []).length;
        if (openBraces > closeBraces) {
          repairedJson += '}'.repeat(openBraces - closeBraces);
        }
        
        const repaired = JSON.parse(repairedJson);
        if (repaired.story) {
          console.info('✅ [story] Successfully repaired truncated JSON');
          const story = repaired.story;
          return {
            prompt: prompt,
            gradeLevel: gradeLevel,
            title: story.title || 'Story',
            content: story.content || [],
            characters: story.characters || [],
            setting: story.setting || '',
            moral: story.moral || '',
            tags: story.tags || story.requiredCategoryTags || [],
            timestamp: new Date().toISOString(),
            requiredCategoryTags: story.requiredCategoryTags || [],
            optionalTags: story.optionalTags || []
          };
        }
      } catch (repairError) {
        console.error('❌ [story] JSON repair failed:', repairError);
      }
    }
    
    console.error('❌ [story] Could not parse or repair JSON response');
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
      model: MODEL_NAME,
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
      model: MODEL_NAME,
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
      model: MODEL_NAME,
    });
    await flushApiLogger();

    // Create standardized error response
    const errorResponse = createErrorResponse(error, 'story', { 
      prompt: req.body?.prompt 
    });
    
    return res.status(errorResponse.status).json(errorResponse.body);
  }
}