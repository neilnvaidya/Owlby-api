import { tagsResponseSchema } from '../../lib/ai-schemas';
import { getTagsInstructions } from '../../lib/ai-instructions';
import {
  handleCORS,
  processAIRequest,
  normalizeAchievementTags,
} from '../../lib/api-handler';
import { verifySupabaseToken } from '../../lib/auth-supabase';
import { checkRateLimit } from '../../lib/rate-limit';

const MAX_CONTEXT_LENGTH = 2000;
const TAGS_MAX_OUTPUT_TOKENS = 256;

function processTagsResponse(responseText: string): {
  requiredCategoryTags: string[];
  optionalTags: string[];
} {
  try {
    const json = JSON.parse(responseText);
    const data = {
      requiredCategoryTags: Array.isArray(json.requiredCategoryTags) ? json.requiredCategoryTags : [],
      optionalTags: Array.isArray(json.optionalTags) ? json.optionalTags : [],
    };
    normalizeAchievementTags(data);
    return data;
  } catch (e) {
    console.warn('[TAGS API] Failed to parse response, using defaults:', e);
    return { requiredCategoryTags: [], optionalTags: [] };
  }
}

export default async function handler(req: any, res: any) {
  if (!handleCORS(req, res)) return;

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
  } catch {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      userMessage: 'Session expired. Please sign in again.',
    });
  }

  const userId = decoded?.id || 'unknown';

  const rate = checkRateLimit(`tags:${userId}`, 30, 60 * 1000);
  if (!rate.allowed) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      userMessage: 'Please wait a moment before requesting tags again.',
      retryAfterMs: rate.retryAfterMs,
    });
  }

  const { context, source } = req.body || {};
  const contextStr = typeof context === 'string' ? context.trim() : '';
  const sourceVal = source === 'chat' || source === 'lesson' || source === 'story' ? source : undefined;

  if (!contextStr) {
    return res.status(400).json({
      success: false,
      error: 'Missing context',
      userMessage: 'Please provide context text.',
    });
  }

  const truncatedContext = contextStr.length > MAX_CONTEXT_LENGTH
    ? contextStr.slice(0, MAX_CONTEXT_LENGTH) + '…'
    : contextStr;

  try {
    const systemInstructions = getTagsInstructions(truncatedContext, sourceVal);
    const contents = [
      {
        role: 'user' as const,
        parts: [{ text: truncatedContext }],
      },
    ];

    const { responseText } = await processAIRequest(
      tagsResponseSchema,
      systemInstructions,
      contents,
      'tags',
      truncatedContext.slice(0, 100),
      TAGS_MAX_OUTPUT_TOKENS
    );

    const tags = processTagsResponse(responseText);

    return res.status(200).json({
      success: true,
      requiredCategoryTags: tags.requiredCategoryTags,
      optionalTags: tags.optionalTags,
    });
  } catch (error: any) {
    console.error('[TAGS API] Error:', error?.message || error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to generate tags',
      userMessage: 'Could not generate tags. Please try again.',
    });
  }
}
