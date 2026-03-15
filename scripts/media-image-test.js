#!/usr/bin/env node
/**
 * Live test for the Wikimedia image API.
 * Calls GET /api/media/image?tags=... and asserts we get a valid image URL and attribution.
 *
 * Usage:
 *   node scripts/media-image-test.js
 *   node scripts/media-image-test.js volcano bee
 *
 * Uses API_BASE_URL from api-route-test-config.js (no auth required).
 * Exit code: 0 on success, 1 on failure (CI-friendly).
 */

import { API_BASE_URL as CONFIG_API_BASE_URL } from './api-route-test-config.js';

const API_BASE_URL = process.env.OWLBY_API_BASE_URL || CONFIG_API_BASE_URL;
const DEFAULT_TAGS = ['prism', 'flamingo'];
const TIMEOUT_MS = 15000;

function log(msg) {
  console.log(`[media-image-test] ${msg}`);
}

async function run() {
  const tagArgs = process.argv.slice(2).filter(Boolean);
  const tags = tagArgs.length > 0 ? tagArgs : DEFAULT_TAGS;
  const tagsQuery = tags.join(',');

  const url = `${API_BASE_URL}/api/media/image?tags=${encodeURIComponent(tagsQuery)}`;
  log(`GET ${url}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;
  let body;

  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const text = await res.text();
    try {
      body = JSON.parse(text);
    } catch {
      log(`Invalid JSON: ${text.slice(0, 200)}`);
      process.exit(1);
    }
  } catch (err) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      log('Request timed out');
    } else {
      log(`Request failed: ${err?.message || err}`);
    }
    process.exit(1);
  }

  if (res.status !== 200) {
    log(`Expected 200, got ${res.status}: ${body?.error || text?.slice(0, 200) || 'unknown'}`);
    process.exit(1);
  }

  const imageUrl = body?.imageUrl;
  const attributionUrl = body?.attributionUrl;

  if (typeof imageUrl !== 'string' || !imageUrl.trim()) {
    log('Missing or empty imageUrl in response');
    process.exit(1);
  }

  if (typeof attributionUrl !== 'string' || !attributionUrl.trim()) {
    log('Missing or empty attributionUrl in response');
    process.exit(1);
  }

  log(`imageUrl: ${imageUrl}`);
  log(`attributionUrl: ${attributionUrl}`);

  // Optional: verify image URL is reachable
  try {
    const headController = new AbortController();
    const headTimeout = setTimeout(() => headController.abort(), 5000);
    const headRes = await fetch(imageUrl, { method: 'HEAD', signal: headController.signal });
    clearTimeout(headTimeout);
    if (!headRes.ok) {
      log(`Warning: image URL returned ${headRes.status}`);
    }
  } catch (e) {
    log(`Warning: could not HEAD image URL: ${e?.message || e}`);
  }

  log('OK');
  process.exit(0);
}

run();
