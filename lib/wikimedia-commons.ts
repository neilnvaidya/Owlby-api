/**
 * Wikimedia Commons REST API client.
 * Fetches relevant images by search query; returns image URL and attribution.
 * Optional bot-password auth for higher rate limits (set WIKIMEDIA_BOT_USER and WIKIMEDIA_BOT_PASSWORD).
 * @see https://public-paws.wmcloud.org/User:APaskulin_(WMF)/en-wikipedia-images.ipynb
 */

const COMMONS_BASE = 'https://commons.wikimedia.org/w/rest.php/v1/';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'Owlby/1.0 (https://owlby.com)';

let cachedCookie: string | null = null;
const CACHE_TTL_MS = 50 * 60 * 1000; // 50 minutes
let cacheExpiry = 0;

/**
 * Login to Commons with bot password; returns Cookie header value for authenticated requests.
 * Set env WIKIMEDIA_BOT_USER (e.g. MyUser@mybot) and WIKIMEDIA_BOT_PASSWORD.
 * See docs/WIKIMEDIA-AUTH.md for setup.
 */
async function getCommonsAuth(): Promise<string | null> {
  if (Date.now() < cacheExpiry && cachedCookie) return cachedCookie;
  const user = process.env.WIKIMEDIA_BOT_USER?.trim();
  const password = process.env.WIKIMEDIA_BOT_PASSWORD?.trim();
  if (!user || !password) return null;

  try {
    const tokenRes = await fetch(
      `${COMMONS_API}?action=query&meta=tokens&type=login&format=json`,
      { headers: { 'User-Agent': USER_AGENT } }
    );
    const tokenData = (await tokenRes.json()) as { query?: { tokens?: { logintoken?: string } } };
    const logintoken = tokenData?.query?.tokens?.logintoken;
    if (!logintoken) return null;

    const params = new URLSearchParams({
      action: 'login',
      lgname: user,
      lgpassword: password,
      lgtoken: logintoken,
      format: 'json',
    });
    const loginRes = await fetch(COMMONS_API, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const loginData = (await loginRes.json()) as { login?: { result?: string } };
    if (loginData?.login?.result !== 'Success') return null;

    const h = loginRes.headers as Headers & { getSetCookie?(): string[] };
    const setCookies =
      typeof h.getSetCookie === 'function'
        ? h.getSetCookie()
        : ([loginRes.headers.get('set-cookie'), loginRes.headers.get('Set-Cookie')].filter(Boolean) as string[]);
    const cookie = setCookies
      .map((c) => String(c).split(';')[0].trim())
      .filter(Boolean)
      .join('; ');
    if (!cookie) return null;

    cachedCookie = cookie;
    cacheExpiry = Date.now() + CACHE_TTL_MS;
    return cookie;
  } catch {
    return null;
  }
}

function commonsHeaders(cookie: string | null): Record<string, string> {
  const h: Record<string, string> = { 'User-Agent': USER_AGENT };
  if (cookie) h['Cookie'] = cookie;
  return h;
}

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
  const cookie = await getCommonsAuth();
  const url = new URL('search/page', COMMONS_BASE);
  url.searchParams.set('q', query.trim());
  url.searchParams.set('limit', String(Math.min(limit, 50)));

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: commonsHeaders(cookie),
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
  const cookie = await getCommonsAuth();

  const res = await fetch(url, {
    method: 'GET',
    headers: commonsHeaders(cookie),
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

  if (!imageUrl || typeof imageUrl !== 'string') {
    return null;
  }
  // Accept photos (BITMAP) and diagrams/illustrations (DRAWING, i.e. SVG) — diagrams
  // are often the clearest image for an educational topic. Skip PDFs and other
  // document types. For DRAWING, Commons' `preferred.url` is a rasterized PNG
  // (e.g. ".../500px-Foo.svg.png"), which React Native's <Image> can render — but we
  // double-check the URL is a raster, because RN cannot display a raw .svg.
  if (preferred?.mediatype === 'DRAWING') {
    if (!/\.(png|jpe?g)$/i.test(imageUrl)) {
      return null;
    }
  } else if (preferred?.mediatype !== 'BITMAP') {
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
 * - Short 2–3 word phrases are wrapped in quotes for a tighter match (e.g. "honey bee").
 *   Longer phrases are left UNQUOTED: an exact-phrase match on a 4+ word string
 *   (e.g. a topic+objective title, or a chat sentence fallback) reliably returns
 *   zero results, which silently kills the whole fallback chain. Unquoted, Commons
 *   defaults to AND-matching the terms, which is what we want for those longer queries.
 * - We append filemime:image so results are mostly image files; first hit is often a valid bitmap.
 */
function buildImageSearchQuery(userQuery: string): string {
  const trimmed = userQuery.trim();
  if (!trimmed) return DEFAULT_FALLBACK_QUERY + IMAGE_FILTER;
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
  const phrase = words.length >= 2 && words.length <= 3 ? `"${trimmed}"` : trimmed;
  return phrase + IMAGE_FILTER;
}

/**
 * Rank boost (in search-result positions) for how well a Commons file title matches
 * the query. Commons' own full-text search rank (filename + caption + categories +
 * wikitext) is the primary relevance signal; filename word-overlap is only a light
 * tiebreaker layered on top, NOT a hard filter.
 *
 *   - 5 ("strong")  every search word appears as a whole word in the filename.
 *   - 2 ("weak")    at least one search word appears (whole word or substring).
 *   - 0 ("none")    no overlap — keep the result, just don't promote it.
 *
 * This replaces the old "drop every score-0 file" floor, which silently discarded
 * correct images whose filenames are opaque (camera codes, non-English, etc.) —
 * e.g. it threw away Pont du Gard / Apis mellifera photos for "Roman aqueduct" /
 * "honey bee" even though they were Commons' top hits.
 */
function filenameMatchBoost(search: string, title: string): number {
  if (!title || !search) return 0;
  const searchWords = search
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  if (searchWords.length === 0) return 0;
  const namePart = title.replace(/^File:/i, '').replace(/\.[a-z0-9]+$/i, '');
  const nameWords = namePart
    .toLowerCase()
    .split(/[\s_\-–—(),]+/)
    .filter((w) => w.length > 0);
  const nameLower = namePart.toLowerCase();
  let wholeWordMatches = 0;
  let anyMatches = 0;
  for (const word of searchWords) {
    if (nameWords.includes(word)) {
      wholeWordMatches++;
      anyMatches++;
    } else if (nameLower.includes(word)) {
      anyMatches++;
    }
  }
  if (wholeWordMatches === searchWords.length) return 5; // every query word present → strong
  if (anyMatches > 0) return 2; // partial overlap → weak
  return 0;
}

/**
 * Get one relevant image from Commons for a single search query.
 * Orders results by Commons search rank, nudged by a bounded filename-overlap boost,
 * then returns the first that resolves to a valid raster image (skipping avoided URLs).
 * Query should be a short, descriptive phrase suitable for Commons (e.g. "honey bee", "prism optical").
 */
async function getOneImageForQuery(
  query: string,
  avoidUrls?: Set<string>
): Promise<GetImageResult | null> {
  const searchQ = buildImageSearchQuery(query);
  const pages = await searchPages(searchQ, 15);
  const filePages = pages.filter((p) => p.title && p.title.startsWith('File:'));

  // Commons returns filePages in relevance order; that rank is our primary signal.
  // A strong filename match can promote a result by up to 5 positions, but a weak or
  // absent match never drops a well-ranked result out of contention — so when the
  // filename gives no usable signal (opaque codes, other languages) we still fall
  // back to Commons' top-ranked hit instead of returning nothing.
  const ranked = filePages
    .map((page, searchIndex) => ({
      page,
      searchIndex,
      adjustedIndex: searchIndex - filenameMatchBoost(query, page.title),
    }))
    .sort((a, b) => a.adjustedIndex - b.adjustedIndex || a.searchIndex - b.searchIndex);

  for (const { page } of ranked) {
    const details = await getFileDetails(page.title);
    if (details) {
      // Skip images the caller has already shown (e.g. a previous chunk/message),
      // so we keep looking down the ranked list for a distinct one.
      if (avoidUrls && avoidUrls.size > 0 && avoidUrls.has(details.imageUrl)) {
        continue;
      }
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
  fallbackQuery?: string,
  avoidUrls?: Set<string>
): Promise<ImageForTagResult[]> {
  const trimmed = tags.filter((t) => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim());
  const queries = trimmed.length > 0 ? trimmed : [fallbackQuery?.trim() || DEFAULT_FALLBACK_QUERY];

  const results = await Promise.all(
    queries.map(async (tag): Promise<ImageForTagResult> => {
      const result = await getOneImageForQuery(tag, avoidUrls);
      if (result) {
        return { tag, ...result };
      }
      return { tag, error: 'No suitable image found.' };
    })
  );

  return results;
}
