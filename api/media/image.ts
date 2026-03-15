import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getImageForTags } from '../../lib/wikimedia-commons.js';

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((t) => typeof t === 'string').map((t) => String(t).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((t) => t.trim()).filter(Boolean);
  }
  return [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  let tags: string[] = [];
  let fallbackQuery: string | undefined;

  if (req.method === 'GET') {
    const tagsParam = req.query.tags;
    const queryParam = req.query.query;
    tags = parseTags(tagsParam);
    fallbackQuery = typeof queryParam === 'string' ? queryParam.trim() : undefined;
  } else {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    tags = parseTags((body as { tags?: unknown }).tags);
    fallbackQuery = typeof (body as { query?: string }).query === 'string'
      ? (body as { query: string }).query.trim()
      : undefined;
  }

  try {
    const result = await getImageForTags(tags, fallbackQuery);

    if ('error' in result) {
      return res.status(404).json({ error: result.error });
    }

    return res.status(200).json({
      imageUrl: result.imageUrl,
      attributionUrl: result.attributionUrl,
      matchedQuery: result.matchedQuery,
      ...(result.width != null && { width: result.width }),
      ...(result.height != null && { height: result.height }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch image from Wikimedia Commons';
    console.error('[media/image]', message, err);
    return res.status(502).json({ error: message });
  }
}
