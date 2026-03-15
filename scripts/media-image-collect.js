#!/usr/bin/env node
/**
 * Collect Wikimedia Commons search results for many tags (one search per tag).
 * Calls Commons search API directly; logs all result filenames per tag for analysis.
 * Rate-limited to max ~3 requests/second.
 *
 * Usage:
 *   node scripts/media-image-collect.js
 *
 * Output: scripts/media-image-audit.json
 *   Each entry: {"search": "word", "results": ["filename1", "filename2", ...]}
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.join(__dirname, 'media-image-audit.json');
const COMMONS_BASE = 'https://commons.wikimedia.org/w/rest.php/v1/';
const USER_AGENT = 'Owlby/1.0 (https://owlby.com)';
const RATE_LIMIT_MS = 340;
const REQUEST_TIMEOUT_MS = 15000;
const SEARCH_LIMIT = 15; // number of results to request per search

/**
 * Search phrases (like Gemini might suggest for "list of images to fetch").
 * Multi-word searches often return more relevant Commons results than single words.
 */
const TAGS = [
  'honey bee',
  'prism optical',
  'flamingo bird',
  'volcano eruption',
  'rainbow sky',
  'sun star',
  'moon night',
  'fish ocean',
  'tree nature',
  'butterfly insect',
  'dinosaur fossil',
  'planet space',
  'pyramid Egypt',
  'water cycle',
  'atom science',
  'coral reef ocean',
  'tadpole frog',
  'quartz crystal',
  'aurora northern lights',
  'hummingbird bird',
];

function log(msg) {
  console.log(`[media-image-collect] ${msg}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** "File:Lightmatter_flamingo2.jpg" -> "Lightmatter_flamingo2.jpg" */
function filenameFromTitle(title) {
  if (!title || typeof title !== 'string') return null;
  if (title.startsWith('File:')) {
    return title.slice(5).trim();
  }
  return title;
}

/**
 * Call Commons search/page; return list of filenames (all File: results in order).
 */
async function searchCommons(tag) {
  const url = `${COMMONS_BASE}search/page?q=${encodeURIComponent(tag.trim())}&limit=${SEARCH_LIMIT}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return { error: `HTTP ${res.status}` };
    }

    const data = await res.json().catch(() => ({}));
    const pages = Array.isArray(data.pages) ? data.pages : [];
    const filenames = pages
      .filter((p) => p.title && p.title.startsWith('File:'))
      .map((p) => filenameFromTitle(p.title))
      .filter(Boolean);

    return { results: filenames };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      error: err?.name === 'AbortError' ? 'Request timeout' : (err?.message || String(err)),
    };
  }
}

async function run() {
  log(`Source: Wikimedia Commons search/page`);
  log(`Tags: ${TAGS.length} (one search per tag, ${SEARCH_LIMIT} results each)`);
  log(`Rate limit: ${RATE_LIMIT_MS}ms between requests`);
  log(`Output: ${OUTPUT_FILE}`);
  log('');

  const outputResults = [];
  const start = Date.now();

  for (let i = 0; i < TAGS.length; i++) {
    const search = TAGS[i];
    log(`[${i + 1}/${TAGS.length}] ${search}`);

    const out = await searchCommons(search);

    if (out.error) {
      log(`  -> error: ${out.error}`);
      outputResults.push({ search, error: out.error });
    } else {
      const filenames = out.results || [];
      outputResults.push({ search, results: filenames });
      if (filenames.length === 0) {
        log(`  -> (no file results)`);
      } else {
        filenames.forEach((f, j) => log(`  ${j + 1}. ${f}`));
      }
    }

    if (i < TAGS.length - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const payload = {
    collectedAt: new Date().toISOString(),
    source: 'wikimedia-commons',
    searchLimitPerTag: SEARCH_LIMIT,
    rateLimitMs: RATE_LIMIT_MS,
    totalSearches: TAGS.length,
    elapsedSeconds: parseFloat(elapsed),
    results: outputResults,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), 'utf8');
  log('');
  log(`Done in ${elapsed}s. Wrote ${OUTPUT_FILE}`);
}

run().catch((err) => {
  console.error('[media-image-collect]', err);
  process.exit(1);
});
