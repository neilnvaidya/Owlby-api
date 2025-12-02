import { logLessonCall, flushApiLogger } from '../../lib/api-logger';
import { lessonResponseSchema } from '../../lib/ai-schemas';
import { getLessonInstructions } from '../../lib/ai-instructions';
import { 
  handleCORS, 
  processAIRequest, 
  normalizeAchievementTags, 
  createErrorResponse 
} from '../../lib/api-handler';

/**
 * Process the JSON response from lesson generation API
 * No truncation applied - AI schema and instructions constrain output sizes appropriately
 */
function processLessonResponse(responseText: string, topic: string, gradeLevel: number) {
  try {
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
        // Include normalized achievement tags
        requiredCategoryTags: lesson.requiredCategoryTags || [],
        optionalTags: lesson.optionalTags || []
      };
    } else {
      throw new Error('Invalid lesson JSON structure');
    }
  } catch (error) {
    console.error('Failed to parse lesson JSON response:', error);
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
    logLessonCall({
      userId,
      gradeLevel,
      topic: topic || 'unknown',
      responseTimeMs: Date.now() - startTime,
      success: false,
      error: 'BadRequest',
      model: 'unknown',
    });
    await flushApiLogger();
    
    return res.status(400).json({ error: "Topic is required." });
  }

  try {
    // Build system instructions
    const systemInstructions = getLessonInstructions(topic, gradeLevel);
    
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
    
    // Process AI request using centralized handler with retry and fallback
    const { responseText, usageMetadata, modelUsed, fallbackUsed } = await processAIRequest(
      lessonResponseSchema,
      systemInstructions,
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
      model: modelUsed,
    });
    await flushApiLogger();
    
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
      model: 'unknown',
    });
    await flushApiLogger();

    // Create standardized error response
    const errorResponse = createErrorResponse(error, 'lesson', { 
      topic: req.body?.topic 
    });
    
    return res.status(errorResponse.status).json(errorResponse.body);
  }
}