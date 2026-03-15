#!/usr/bin/env node
/**
 * Live test for the Wikimedia image API.
 * One request with multiple tags; API fetches one image per tag from Commons in parallel.
 * Asserts we get a valid image (or error) for each tag.
 *
 * Usage:
 *   node scripts/media-image-test.js
 *   node scripts/media-image-test.js prism flamingo
 *
 * Uses API_BASE_URL from api-route-test-config.js (no auth required).
 * Exit code: 0 on success, 1 on failure (CI-friendly).
 */

import { API_BASE_URL as CONFIG_API_BASE_URL } from './api-route-test-config.js';

const API_BASE_URL = process.env.OWLBY_API_BASE_URL || CONFIG_API_BASE_URL;
const DEFAULT_TAGS = ['prism', 'flamingo'];
const TIMEOUT_MS = 20000;

function log(msg) {
  console.log(`[media-image-test] ${msg}`);
}

async function run() {
  const tagArgs = process.argv.slice(2).filter(Boolean);
  const tags = tagArgs.length > 0 ? tagArgs : DEFAULT_TAGS;
  const tagsQuery = tags.join(',');

  const url = `${API_BASE_URL}/api/media/image?tags=${encodeURIComponent(tagsQuery)}`;
  log(`GET ${url} (expect ${tags.length} image(s), fetched in parallel per tag)`);

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
    log(`Expected 200, got ${res.status}: ${body?.error ?? text?.slice(0, 200) ?? 'unknown'}`);
    process.exit(1);
  }

  const images = body?.images;
  if (!Array.isArray(images)) {
    log('Missing or invalid images array in response');
    process.exit(1);
  }

  if (images.length !== tags.length) {
    log(`Expected ${tags.length} result(s), got ${images.length}`);
    process.exit(1);
  }

  let failed = 0;
  for (let i = 0; i < images.length; i++) {
    const item = images[i];
    const tag = item?.tag ?? tags[i];
    if (item?.error) {
      log(`  [${tag}] error: ${item.error}`);
      failed++;
      continue;
    }
    const imageUrl = item?.imageUrl;
    const attributionUrl = item?.attributionUrl;
    if (typeof imageUrl !== 'string' || !imageUrl.trim() || typeof attributionUrl !== 'string' || !attributionUrl.trim()) {
      log(`  [${tag}] missing imageUrl or attributionUrl`);
      failed++;
      continue;
    }
    log(`  [${tag}] imageUrl: ${imageUrl}`);
    log(`  [${tag}] attributionUrl: ${attributionUrl}`);

    // Optional: verify image URL is reachable
    try {
      const headController = new AbortController();
      const headTimeout = setTimeout(() => headController.abort(), 5000);
      const headRes = await fetch(imageUrl, { method: 'HEAD', signal: headController.signal });
      clearTimeout(headTimeout);
      if (!headRes.ok) {
        log(`  [${tag}] warning: image URL returned ${headRes.status}`);
      }
    } catch (e) {
      log(`  [${tag}] warning: could not HEAD image: ${e?.message || e}`);
    }
  }

  if (failed > 0) {
    log(`${failed} of ${tags.length} tag(s) failed`);
    process.exit(1);
  }

  log('OK');
  process.exit(0);
}

run();
