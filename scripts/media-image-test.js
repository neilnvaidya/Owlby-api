#!/usr/bin/env node
/**
 * Live test for the Wikimedia image API.
 * One request with one or more tags; the API resolves a SINGLE best image from
 * the combined tags/topic and returns { success, image }.
 * Asserts we get one valid image back.
 *
 * Usage:
 *   node scripts/media-image-test.js
 *   node scripts/media-image-test.js prism flamingo
 *
 * Uses API_BASE_URL from api-route-test-config.js.
 * NOTE: /api/media/image now requires a Supabase bearer token. Set
 *   OWLBY_TEST_BEARER=<token> to authenticate (otherwise expect HTTP 401).
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
  log(`GET ${url} (expect a single resolved image)`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const headers = { Accept: 'application/json' };
  if (process.env.OWLBY_TEST_BEARER) {
    headers.Authorization = `Bearer ${process.env.OWLBY_TEST_BEARER}`;
  }

  let res;
  let body;

  try {
    res = await fetch(url, {
      method: 'GET',
      headers,
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

  // Endpoint resolves a single best image from the combined tags/topic.
  const image = body?.image;
  if (!image) {
    log(`No image in response${body?.error ? `: ${body.error}` : ''}`);
    process.exit(1);
  }

  const imageUrl = image?.imageUrl;
  const attributionUrl = image?.attributionUrl;
  if (
    typeof imageUrl !== 'string' || !imageUrl.trim() ||
    typeof attributionUrl !== 'string' || !attributionUrl.trim()
  ) {
    log('Resolved image missing imageUrl or attributionUrl');
    process.exit(1);
  }
  log(`  imageUrl: ${imageUrl}`);
  log(`  attributionUrl: ${attributionUrl}`);
  if (image.queryUsed) log(`  queryUsed: ${image.queryUsed}`);

  // Optional: verify image URL is reachable
  try {
    const headController = new AbortController();
    const headTimeout = setTimeout(() => headController.abort(), 5000);
    const headRes = await fetch(imageUrl, { method: 'HEAD', signal: headController.signal });
    clearTimeout(headTimeout);
    if (!headRes.ok) {
      log(`  warning: image URL returned ${headRes.status}`);
    }
  } catch (e) {
    log(`  warning: could not HEAD image: ${e?.message || e}`);
  }

  log('OK');
  process.exit(0);
}

run();
