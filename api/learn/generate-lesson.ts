import { logLessonCall, flushApiLogger } from '../../lib/api-logger';
import { lessonResponseSchema } from '../../lib/ai-schemas';
import { getLessonInstructions } from '../../lib/ai-instructions';
import { buildAIConfig, MODEL_NAME } from '../../lib/ai-config';
import { 
  handleCORS, 
  processAIRequest, 
  normalizeAchievementTags, 
  createErrorResponse 
} from '../../lib/api-handler';

/**
 * Process the JSON response from lesson generation API
 * Handles truncated or malformed JSON gracefully
 */
function processLessonResponse(responseText: string, topic: string, gradeLevel: number) {
  try {
    // Log the raw response for debugging
    if (process.env.NODE_ENV === 'development') {
      console.debug('[lesson] Raw response length:', responseText.length);
      console.debug('[lesson] Raw response preview:', responseText.slice(0, 200));
    }
    
    const jsonResponse = JSON.parse(responseText);
    
    if (jsonResponse.lesson) {
      const lesson = jsonResponse.lesson;
      return {
        topic: topic,
        gradeLevel: gradeLevel,
        title: lesson.title,
        introduction: lesson.introduction.replace(/\\n/g, '\n'),
        body: (lesson.body || []).map((p: string) => p.replace(/\\n/g, '\n')),
        conclusion: lesson.conclusion,
        keyPoints: lesson.keyPoints || [],
        keywords: lesson.keywords || [],
        challengeQuiz: {
          questions: lesson.challengeQuiz || []
        },
        tags: lesson.tags || [],
        difficulty: lesson.difficulty ?? 10,
        // Optional CSS-based visual representation, passed through for clients that support it
        visual: lesson.visual || null,
        // Include normalized achievement tags
        requiredCategoryTags: lesson.requiredCategoryTags || [],
        optionalTags: lesson.optionalTags || []
      };
    } else {
      throw new Error('Invalid lesson JSON structure');
    }
  } catch (error: any) {
    // Log the full response when parsing fails for debugging
    console.error('❌ [lesson] Failed to parse JSON response');
    console.error('❌ [lesson] Error:', error.message);
    console.error('❌ [lesson] Response length:', responseText.length);
    console.error('❌ [lesson] Response text (first 500 chars):', responseText.slice(0, 500));
    console.error('❌ [lesson] Response text (last 200 chars):', responseText.slice(-200));
    
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
          // Add missing closing braces
          repairedJson += '}'.repeat(openBraces - closeBraces);
        }
        
        const repaired = JSON.parse(repairedJson);
        if (repaired.lesson) {
          console.info('✅ [lesson] Successfully repaired truncated JSON');
          const lesson = repaired.lesson;
          return {
            topic: topic,
            gradeLevel: gradeLevel,
            title: lesson.title || 'Lesson',
            introduction: (lesson.introduction || '').replace(/\\n/g, '\n'),
            body: (lesson.body || []).map((p: string) => p.replace(/\\n/g, '\n')),
            conclusion: lesson.conclusion || '',
            keyPoints: lesson.keyPoints || [],
            keywords: lesson.keywords || [],
            challengeQuiz: {
              questions: lesson.challengeQuiz || []
            },
            tags: lesson.tags || [],
            difficulty: lesson.difficulty ?? 10,
            visual: lesson.visual || null,
            requiredCategoryTags: lesson.requiredCategoryTags || [],
            optionalTags: lesson.optionalTags || []
          };
        }
      } catch (repairError) {
        // Repair failed, continue with error
        console.error('❌ [lesson] JSON repair failed:', repairError);
      }
    }
    
    console.error('❌ [lesson] Could not parse or repair JSON response');
    throw new Error(`Failed to generate lesson: Invalid response format. Please try again.`);
  }
}

export default async function handler(req: any, res: any) {
  // Handle CORS and validate request method
  if (!handleCORS(req, res)) return;

  const startTime = Date.now();
  const { topic, gradeLevel = 3, userId } = req.body;
  
  // Validate required parameters
  if (!topic) {
    console.info('❌ Missing topic');
    
    logLessonCall({
      userId,
      gradeLevel,
      topic: topic || 'unknown',
      responseTimeMs: Date.now() - startTime,
      success: false,
      error: 'BadRequest',
      model: MODEL_NAME,
    });
    await flushApiLogger();
    
    return res.status(400).json({ error: "Topic is required." });
  }

  try {
    console.info('📚 [lesson] Request received for topic:', topic);
    
    // Build system instructions
    const systemInstructions = getLessonInstructions(topic, gradeLevel);

    // Build AI configuration
    const config = buildAIConfig(lessonResponseSchema, systemInstructions);
    
    // Create contents for AI request
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: `topic = ${topic}, grade ${gradeLevel}, age ${gradeLevel + 5}`,
          },
        ],
      },
    ];
    
    // Process AI request using centralized handler
    const { responseText, usageMetadata } = await processAIRequest(
      config, 
      contents, 
      'lesson', 
      topic
    );
    
    // Process the lesson response
    const processedResponse = processLessonResponse(responseText, topic, gradeLevel);
    
    // Normalize achievement tags
    normalizeAchievementTags(processedResponse);

    // Log successful request
    logLessonCall({
      userId,
      gradeLevel,
      topic,
      responseText,
      responseTimeMs: Date.now() - startTime,
      success: true,
      usageMetadata,
      model: MODEL_NAME,
    });
    await flushApiLogger();

    console.info('✅ [lesson] Successfully generated lesson for topic:', topic);
    
    return res.status(200).json(processedResponse);
    
  } catch (error: any) {
    // Log failed request
    logLessonCall({
      userId,
      gradeLevel,
      topic,
      responseTimeMs: Date.now() - startTime,
      success: false,
      error: error.message || 'UnknownError',
      model: MODEL_NAME,
    });
    await flushApiLogger();

    // Create standardized error response
    const errorResponse = createErrorResponse(error, 'lesson', { 
      topic: req.body?.topic 
    });
    
    return res.status(errorResponse.status).json(errorResponse.body);
  }
}