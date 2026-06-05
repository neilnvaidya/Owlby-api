#!/usr/bin/env node
/**
 * Call the media image API for each audit tag and record which filename we get.
 * Use after deploying similarity scoring + blocklist to verify we serve better results.
 *
 * Usage:
 *   node scripts/media-image-verify-api.js
 *   OWLBY_API_BASE_URL=http://localhost:3001 node scripts/media-image-verify-api.js
 *
 * Output: scripts/media-image-api-verify.json (and console)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { API_BASE_URL as CONFIG_API_BASE_URL } from './api-route-test-config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_BASE_URL = process.env.OWLBY_API_BASE_URL || CONFIG_API_BASE_URL;
const OUTPUT_FILE = path.join(__dirname, 'media-image-api-verify.json');
const RATE_LIMIT_MS = 340;
const REQUEST_TIMEOUT_MS = 20000;

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
  console.log(`[media-image-verify-api] ${msg}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function filenameFromAttributionUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const segment = new URL(url).pathname.split('/').filter(Boolean).pop();
    return segment ? segment.replace(/^File:/i, '') : null;
  } catch {
    return null;
  }
}

async function fetchOne(tag) {
  const url = `${API_BASE_URL}/api/media/image?tags=${encodeURIComponent(tag)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const body = await res.json().catch(() => ({}));
    if (res.status !== 200) {
      return { tag, error: body?.error || `HTTP ${res.status}` };
    }
    // Endpoint returns a single { success, image } payload (image may be null).
    const image = body?.image;
    if (!image) {
      return { tag, error: body?.error || 'No image in response' };
    }
    const filename = filenameFromAttributionUrl(image.attributionUrl);
    return { tag, filename: filename || image.imageUrl?.split('/').pop() || null };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      tag,
      error: err?.name === 'AbortError' ? 'Request timeout' : (err?.message || String(err)),
    };
  }
}

async function run() {
  log(`API: ${API_BASE_URL}`);
  log(`Tags: ${TAGS.length}`);
  log('');

  const results = [];
  for (let i = 0; i < TAGS.length; i++) {
    const tag = TAGS[i];
    log(`[${i + 1}/${TAGS.length}] ${tag}`);
    const row = await fetchOne(tag);
    results.push(row);
    log(`  -> ${row.filename ?? row.error}`);
    if (i < TAGS.length - 1) await sleep(RATE_LIMIT_MS);
  }

  const payload = {
    verifiedAt: new Date().toISOString(),
    apiBaseUrl: API_BASE_URL,
    results,
  };
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), 'utf8');
  log('');
  log(`Wrote ${OUTPUT_FILE}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
