import { tagsResponseSchema } from '../../lib/ai-schemas.js';
import { getTagsInstructions } from '../../lib/ai-instructions.js';
import {
  handleCORS,
  processAIRequest,
  normalizeAchievementTags,
} from '../../lib/api-handler.js';
import { verifySupabaseToken } from '../../lib/auth-supabase.js';
import { checkRateLimit } from '../../lib/rate-limit.js';

const MAX_CONTEXT_LENGTH = 2000;
const TAGS_MAX_OUTPUT_TOKENS = 256;

/**
 * Strip markdown code fence (e.g. ```json ... ```) so we can parse the inner JSON.
 */
function stripMarkdownCodeFence(text: string): string {
  const trimmed = text.trim();
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();
  return trimmed;
}

/**
 * Extract a JSON object from model output that may include a preamble or markdown (e.g. "Here is the JSON:\n```json\n{...}\n```").
 */
function extractJsonObject(text: string): string | null {
  const stripped = stripMarkdownCodeFence(text);
  const start = stripped.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < stripped.length; i++) {
    if (stripped[i] === '{') depth++;
    else if (stripped[i] === '}') {
      depth--;
      if (depth === 0) return stripped.slice(start, i + 1);
    }
  }
  return null;
}

function processTagsResponse(responseText: string): {
  requiredCategoryTags: string[];
  optionalTags: string[];
} {
  let json: any = null;
  const toParse = stripMarkdownCodeFence(responseText);
  try {
    json = JSON.parse(toParse);
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
