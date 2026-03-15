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
    preferred?: { url?: string; width?: number; height?: number };
    file_description_url?: string;
  };

  const preferred = data?.preferred;
  const imageUrl = preferred?.url;
  const descUrl = data?.file_description_url;

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
 * Build search query from tags; use fallback if no tags.
 */
function buildQuery(tags: string[], fallbackQuery?: string): string {
  const trimmed = tags.filter((t) => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim());
  if (trimmed.length > 0) {
    return trimmed.slice(0, 2).join(' ');
  }
  return (fallbackQuery && fallbackQuery.trim()) || DEFAULT_FALLBACK_QUERY;
}

/**
 * Get one relevant image from Commons for the given tags (or fallback query).
 * Skips non-file results (e.g. gallery pages).
 */
export async function getImageForTags(
  tags: string[],
  fallbackQuery?: string
): Promise<GetImageResult | GetImageError> {
  const query = buildQuery(tags, fallbackQuery);
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

  return { error: 'No suitable image found for the given tags.' };
}
