import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCORS } from '../../lib/api-handler.js';
import { verifySupabaseToken } from '../../lib/auth-supabase.js';
import { checkRateLimit } from '../../lib/rate-limit.js';
import { canGenerate } from '../../lib/subscription-gate.js';
import { resolveWikimediaImage } from '../../lib/wikimedia-image.js';

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((t) => typeof t === 'string')
      .map((t) => String(t).trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!handleCORS(req, res)) return;

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Missing authorization token',
      userMessage: 'Please sign in again.',
    });
  }

  let userId = 'unknown';
  try {
    const decoded = await verifySupabaseToken(token);
    userId = decoded?.id || 'unknown';
  } catch {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      userMessage: 'Session expired. Please sign in again.',
    });
  }

  const gate = await canGenerate(userId, 'lesson');
  if (!gate.allowed) {
    return res.status(403).json({
      success: false,
      error: gate.reason || 'subscription_required',
      userMessage:
        gate.reason === 'daily_limit_reached'
          ? "You've reached your daily limit. Upgrade for unlimited access."
          : 'A subscription is required for this feature.',
    });
  }

  const rate = checkRateLimit(`media_image:${userId}`, 20, 60 * 1000);
  if (!rate.allowed) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      retryAfterMs: rate.retryAfterMs,
      userMessage: "I'm finding a lot of images right now. Please try again shortly.",
    });
  }

  // `query` is the strongest signal the client has: the exact phrase that produced the
  // currently-shown image (payload.queryUsed). Routing it to wikimediaQuery (highest
  // priority) lets "Change image" re-run that working query and, via avoidUrls, walk to
  // the next distinct result — instead of being demoted below tags/topic where it never ran.
  let tags: string[] = [];
  let topic = '';
  let query = '';
  let avoidUrls: string[] = [];
  if (req.method === 'GET') {
    tags = parseTags(req.query.tags);
    topic = typeof req.query.topic === 'string' ? req.query.topic : '';
    query = typeof req.query.query === 'string' ? req.query.query : '';
    avoidUrls = parseTags(req.query.avoidUrls);
  } else {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    tags = parseTags((body as { tags?: unknown }).tags);
    topic = typeof (body as { topic?: unknown }).topic === 'string' ? (body as { topic: string }).topic : '';
    query =
      typeof (body as { query?: unknown }).query === 'string' ? (body as { query: string }).query : '';
    avoidUrls = parseTags((body as { avoidUrls?: unknown }).avoidUrls);
  }

  try {
    const image = await resolveWikimediaImage({
      wikimediaQuery: query || undefined,
      optionalTags: tags,
      topic,
      fallbackQuery: topic,
      maxQueries: 3,
      avoidUrls,
    });
    return res.status(200).json({
      success: true,
      image,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch image from Wikimedia Commons';
    return res.status(502).json({
      success: false,
      error: message,
    });
  }
}
