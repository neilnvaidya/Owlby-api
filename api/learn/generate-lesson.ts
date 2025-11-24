import { logLessonCall, flushApiLogger } from '../../lib/api-logger';
import { lessonResponseSchema } from '../../lib/ai-schemas';
import { getLessonInstructions } from '../../lib/ai-instructions';
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
  MAX_INTRODUCTION_LENGTH: 500,
  MAX_BODY_LENGTH: 1000,
  MAX_CONCLUSION_LENGTH: 300,
  MAX_KEYPOINT_LENGTH: 100,
  MAX_DEFINITION_LENGTH: 200,
  MAX_QUESTION_LENGTH: 200,
  MAX_OPTION_LENGTH: 100,
} as const;

/**
 * Truncate text to specified length with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Process the JSON response from lesson generation API
 */
function processLessonResponse(responseText: string, topic: string, gradeLevel: number) {
  try {
    const jsonResponse = JSON.parse(responseText);
    
    if (jsonResponse.lesson) {
      const lesson = jsonResponse.lesson;
      return {
        topic: topic,
        gradeLevel: gradeLevel,
        title: truncateText(lesson.title, TEXT_TRUNCATION.MAX_TITLE_LENGTH),
        introduction: truncateText(lesson.introduction.replace(/\\n/g, '\n'), TEXT_TRUNCATION.MAX_INTRODUCTION_LENGTH),
        body: (lesson.body || []).map((p: string) => 
          truncateText(p.replace(/\\n/g, '\n'), TEXT_TRUNCATION.MAX_BODY_LENGTH)
        ),
        conclusion: truncateText(lesson.conclusion, TEXT_TRUNCATION.MAX_CONCLUSION_LENGTH),
        keyPoints: (lesson.keyPoints || []).map((point: string) => 
          truncateText(point, TEXT_TRUNCATION.MAX_KEYPOINT_LENGTH)
        ),
        keywords: (lesson.keywords || []).map((keyword: any) => ({
          ...keyword,
          term: truncateText(keyword.term, 50),
          definition: truncateText(keyword.definition, TEXT_TRUNCATION.MAX_DEFINITION_LENGTH)
        })),
        challengeQuiz: {
          questions: (lesson.challengeQuiz || []).map((question: any) => ({
            ...question,
            question: truncateText(question.question, TEXT_TRUNCATION.MAX_QUESTION_LENGTH),
            options: (question.options || []).map((option: string) => 
              truncateText(option, TEXT_TRUNCATION.MAX_OPTION_LENGTH)
            )
          }))
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
    console.info('❌ Missing topic');
    
    logLessonCall({
      userId,
      gradeLevel,
      topic: topic || 'unknown',
      responseTimeMs: Date.now() - startTime,
      success: false,
      error: 'BadRequest',
      model: 'gemini-2.5-flash',
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
      model: 'gemini-2.5-flash',
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
      model: 'gemini-2.5-flash',
    });
    await flushApiLogger();

    // Create standardized error response
    const errorResponse = createErrorResponse(error, 'lesson', { 
      topic: req.body?.topic 
    });
    
    return res.status(errorResponse.status).json(errorResponse.body);
  }
}