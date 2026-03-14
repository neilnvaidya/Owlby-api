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

/**
 * Extract a JSON object from model output that may include a preamble (e.g. "Here is the JSON: {...}").
 */
function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < trimmed.length; i++) {
    if (trimmed[i] === '{') depth++;
    else if (trimmed[i] === '}') {
      depth--;
      if (depth === 0) return trimmed.slice(start, i + 1);
    }
  }
  return null;
}

function processTagsResponse(responseText: string): {
  requiredCategoryTags: string[];
  optionalTags: string[];
} {
  let json: any = null;
  try {
    json = JSON.parse(responseText);
  } catch {
    const extracted = extractJsonObject(responseText);
    if (extracted) {
      try {
        json = JSON.parse(extracted);
      } catch (e2) {
        console.warn('[TAGS API] Failed to parse extracted JSON:', e2);
      }
    }
  }
  if (!json || typeof json !== 'object') {
    console.warn('[TAGS API] No valid JSON in response, using defaults. Raw start:', responseText.slice(0, 80));
    return { requiredCategoryTags: [], optionalTags: [] };
  }
  const data = {
    requiredCategoryTags: Array.isArray(json.requiredCategoryTags) ? json.requiredCategoryTags : [],
    optionalTags: Array.isArray(json.optionalTags) ? json.optionalTags : [],
  };
  normalizeAchievementTags(data);
  return data;
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
