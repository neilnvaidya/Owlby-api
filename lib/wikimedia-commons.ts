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

/**
 * Get one relevant image from Commons for a single search query (tag used directly).
 * Skips non-file and non-bitmap results (e.g. gallery pages, PDFs).
 */
async function getOneImageForQuery(query: string): Promise<GetImageResult | null> {
  const pages = await searchPages(query, 10);
  const filePages = pages.filter((p) => p.title && p.title.startsWith('File:'));

  for (const page of filePages) {
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
 * Fetch one image per tag from Commons. Runs all tag searches in parallel (one Wikimedia
 * request per tag at the same time). Uses each tag directly as the search query.
 * Returns an array with one result per tag (image or error).
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
