import type { ImageForTagResult } from './wikimedia-commons.js';
import { getImagesForTags } from './wikimedia-commons.js';

export interface WikimediaImagePayload {
  imageUrl: string;
  attributionUrl: string;
  width?: number;
  height?: number;
  queryUsed: string;
}

interface ResolveWikimediaImageParams {
  /** Explicit short Commons search phrase from AI (most specific, highest priority). */
  wikimediaQuery?: string;
  optionalTags?: string[];
  /** Achievement badge category codes (e.g. "ANIMALS_NATURE") — intentionally NOT
   *  used as search queries because they return irrelevant results. */
  requiredCategoryTags?: string[];
  topic?: string;
  fallbackQuery?: string;
  maxQueries?: number;
  /** Image URLs already shown to this user (e.g. previous chunk/message); skipped. */
  avoidUrls?: string[];
}

function asTrimmed(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function dedupeQueries(queries: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const query of queries) {
    const key = query.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(query);
  }
  return out;
}

function isImageResult(
  result: ImageForTagResult | undefined
): result is {
  tag: string;
  imageUrl: string;
  attributionUrl: string;
  width?: number;
  height?: number;
} {
  return !!result && 'imageUrl' in result && typeof result.imageUrl === 'string';
}

function buildCandidateQueries(params: ResolveWikimediaImageParams): string[] {
  // requiredCategoryTags are achievement badge codes (e.g. "ANIMALS_NATURE") — these
  // are NOT valid Commons search queries and reliably return irrelevant images. Skip them.
  // Priority: explicit wikimediaQuery > optionalTags (free-form topic phrases) > topic > fallback.
  const optional = Array.isArray(params.optionalTags) ? params.optionalTags : [];
  const ordered = [
    asTrimmed(params.wikimediaQuery),
    ...optional.map(asTrimmed).filter(Boolean),
    asTrimmed(params.topic),
    asTrimmed(params.fallbackQuery),
  ].filter((value): value is string => typeof value === 'string');
  return dedupeQueries(ordered);
}

export async function resolveWikimediaImage(
  params: ResolveWikimediaImageParams
): Promise<WikimediaImagePayload | null> {
  const maxQueries = Math.min(Math.max(params.maxQueries ?? 2, 1), 3);
  const candidates = buildCandidateQueries(params).slice(0, maxQueries);
  const avoidUrls =
    Array.isArray(params.avoidUrls) && params.avoidUrls.length > 0
      ? new Set(params.avoidUrls.filter((u): u is string => typeof u === 'string' && u.length > 0))
      : undefined;

  for (const query of candidates) {
    try {
      const [result] = await getImagesForTags([query], query, avoidUrls);
      if (isImageResult(result)) {
        return {
          imageUrl: result.imageUrl,
          attributionUrl: result.attributionUrl,
          width: result.width,
          height: result.height,
          queryUsed: query,
        };
      }
    } catch (error) {
      console.warn('[wikimedia-image] query failed', { query, error });
    }
  }

  return null;
}
