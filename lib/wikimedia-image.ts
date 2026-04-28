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
  optionalTags?: string[];
  requiredCategoryTags?: string[];
  topic?: string;
  fallbackQuery?: string;
  maxQueries?: number;
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
  const required = Array.isArray(params.requiredCategoryTags) ? params.requiredCategoryTags : [];
  const optional = Array.isArray(params.optionalTags) ? params.optionalTags : [];
  const ordered = [
    ...required.map(asTrimmed).filter(Boolean),
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

  for (const query of candidates) {
    try {
      const [result] = await getImagesForTags([query], query);
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
