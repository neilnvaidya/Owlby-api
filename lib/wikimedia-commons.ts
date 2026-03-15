/**
 * Wikimedia Commons REST API client.
 * Fetches relevant images by search query; returns image URL and attribution.
 * @see https://public-paws.wmcloud.org/User:APaskulin_(WMF)/en-wikipedia-images.ipynb
 */

const COMMONS_BASE = 'https://commons.wikimedia.org/w/rest.php/v1/';
const USER_AGENT = 'Owlby/1.0 (https://owlby.com)';

export interface CommonsPage {
  id: number;
  key: string;
  title: string;
  thumbnail?: { url: string; width: number; height: number };
}

export interface CommonsFileDetails {
  imageUrl: string;
  attributionUrl: string;
  width?: number;
  height?: number;
}

export interface GetImageResult {
  imageUrl: string;
  attributionUrl: string;
  width?: number;
  height?: number;
}

export interface GetImageError {
  error: string;
}

/** One image per tag; tag is the search query used. */
export interface ImageForTag {
  tag: string;
  imageUrl: string;
  attributionUrl: string;
  width?: number;
  height?: number;
}

export interface ImageForTagError {
  tag: string;
  error: string;
}

export type ImageForTagResult = ImageForTag | ImageForTagError;

/**
 * Search Commons for pages matching the query.
 */
export async function searchPages(query: string, limit: number = 5): Promise<CommonsPage[]> {
  const url = new URL('search/page', COMMONS_BASE);
  url.searchParams.set('q', query.trim());
  url.searchParams.set('limit', String(Math.min(limit, 50)));

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(`Commons search failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { pages?: CommonsPage[] };
  const pages = Array.isArray(data.pages) ? data.pages : [];
  return pages;
}

/**
 * Get file details (preferred URL, attribution) for a Commons file title.
 * Title should be like "File:Example.jpg". Spaces in URL are sent as underscores.
 */
export async function getFileDetails(title: string): Promise<CommonsFileDetails | null> {
  if (!title || !title.startsWith('File:')) {
    return null;
  }
  // Commons file endpoint uses underscores for spaces in the path
  const pathTitle = title.replace(/ /g, '_');
  const url = `${COMMONS_BASE}file/${encodeURIComponent(pathTitle)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as {
    preferred?: { url?: string; width?: number; height?: number; mediatype?: string };
    file_description_url?: string;
  };

  const preferred = data?.preferred;
  const imageUrl = preferred?.url;
  const descUrl = data?.file_description_url;

  // Only accept bitmap images (photos, PNGs, etc.). Skip PDFs and other document types.
  if (preferred?.mediatype !== 'BITMAP') {
    return null;
  }
  if (!imageUrl || typeof imageUrl !== 'string') {
    return null;
  }

  const attributionUrl = descUrl
    ? (descUrl.startsWith('http') ? descUrl : `https:${descUrl}`)
    : 'https://commons.wikimedia.org/';

  return {
    imageUrl,
    attributionUrl,
    width: typeof preferred?.width === 'number' ? preferred.width : undefined,
    height: typeof preferred?.height === 'number' ? preferred.height : undefined,
  };
}

const DEFAULT_FALLBACK_QUERY = 'nature';

/** Append to search so Commons returns image files first (fewer PDFs → usually 1 file call per tag). */
const IMAGE_FILTER = ' filemime:image';

/**
 * Build a Commons search query that favours image files and optional phrase match.
 * - Multi-word phrases are wrapped in quotes for better match (e.g. "honey bee").
 * - We append filemime:image so results are mostly image files; first hit is often a valid bitmap.
 */
function buildImageSearchQuery(userQuery: string): string {
  const trimmed = userQuery.trim();
  if (!trimmed) return DEFAULT_FALLBACK_QUERY + IMAGE_FILTER;
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
  const phrase = words.length > 1 ? `"${trimmed}"` : trimmed;
  return phrase + IMAGE_FILTER;
}

/**
 * Score how well a Commons file title matches the search query (0 = no match).
 * Uses search-term overlap: whole-word match in filename scores higher than substring.
 * Callers should pass a good Wikimedia search phrase (e.g. from Gemini) for best results.
 */
function scoreFilename(search: string, title: string): number {
  if (!title || !search) return 0;
  const searchWords = search
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  const namePart = title.replace(/^File:/i, '').replace(/\.[a-z0-9]+$/i, '');
  const nameWords = namePart
    .toLowerCase()
    .split(/[\s_\-–—(),]+/)
    .filter((w) => w.length > 0);
  const nameLower = namePart.toLowerCase();
  let score = 0;
  for (const word of searchWords) {
    if (word.length < 2) continue;
    if (nameWords.includes(word)) score += 2;
    else if (nameLower.includes(word)) score += 1;
  }
  return score;
}

/**
 * Get one relevant image from Commons for a single search query.
 * Uses similarity scoring only (search terms in filename); picks highest-scoring valid bitmap.
 * Query should be a short, descriptive phrase suitable for Commons (e.g. "honey bee", "prism optical").
 */
async function getOneImageForQuery(query: string): Promise<GetImageResult | null> {
  const searchQ = buildImageSearchQuery(query);
  const pages = await searchPages(searchQ, 10);
  const filePages = pages.filter((p) => p.title && p.title.startsWith('File:'));

  const scored = filePages
    .map((p) => ({ page: p, score: scoreFilename(query, p.title) }))
    .sort((a, b) => b.score - a.score);

  for (const { page } of scored) {
    const details = await getFileDetails(page.title);
    if (details) {
      return {
        imageUrl: details.imageUrl,
        attributionUrl: details.attributionUrl,
        width: details.width,
        height: details.height,
      };
    }
  }

  return null;
}

/**
 * Fetch one image per tag from Commons. Runs all tag searches in parallel.
 * Each tag is used as the Commons search query (with filemime:image and optional phrase quotes).
 * Call count: 2 per image (search + file), but all N are parallel so e.g. 3 images = 2 round-trips.
 * For best results, pass short descriptive phrases from Gemini (e.g. "honey bee", "prism optical").
 */
export async function getImagesForTags(
  tags: string[],
  fallbackQuery?: string
): Promise<ImageForTagResult[]> {
  const trimmed = tags.filter((t) => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim());
  const queries = trimmed.length > 0 ? trimmed : [fallbackQuery?.trim() || DEFAULT_FALLBACK_QUERY];

  const results = await Promise.all(
    queries.map(async (tag): Promise<ImageForTagResult> => {
      const result = await getOneImageForQuery(tag);
      if (result) {
        return { tag, ...result };
      }
      return { tag, error: 'No suitable image found.' };
    })
  );

  return results;
}
