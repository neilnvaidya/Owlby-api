#!/usr/bin/env node
/**
 * API route tests — hit api-dev.owlby.com to test real handlers (auth, validation, AI).
 * Usage:
 *   node scripts/api-route-test.js health
 *   node scripts/api-route-test.js chat
 *   node scripts/api-route-test.js lesson
 *   node scripts/api-route-test.js story
 *   node scripts/api-route-test.js all
 *
 * Set OWLBY_TEST_TOKEN for chat/lesson/story (Supabase JWT). Results appended to api-test-results.jsonl.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { API_BASE_URL, AUTH_TOKEN, RESULTS_FILE } from './api-route-test-config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_PATH = path.resolve(__dirname, RESULTS_FILE);

const routes = {
  health: {
    method: 'GET',
    path: '/api/profile?scope=health',
    headers: {},
  },
  chat: {
    method: 'POST',
    path: '/api/chat/generate-response',
    headers: { 'Content-Type': 'application/json', Authorization: AUTH_TOKEN ? `Bearer ${AUTH_TOKEN}` : '' },
    body: {
      messages: [{ role: 'user', text: 'What are rainbows?' }],
      chatId: 'test-chat-' + Date.now(),
      gradeLevel: 3,
    },
  },
  lesson: {
    method: 'POST',
    path: '/api/learn/generate-lesson',
    headers: { 'Content-Type': 'application/json', Authorization: AUTH_TOKEN ? `Bearer ${AUTH_TOKEN}` : '' },
    body: {
      topic: 'The science of light and color',
      gradeLevel: 3,
      tags: ['light', 'rainbows'],
    },
  },
  story: {
    method: 'POST',
    path: '/api/story/generate-story',
    headers: { 'Content-Type': 'application/json', Authorization: AUTH_TOKEN ? `Bearer ${AUTH_TOKEN}` : '' },
    body: {
      prompt: 'a prism catching sunlight',
      gradeLevel: 3,
      tags: ['light', 'prism'],
    },
  },
};

function appendResult(obj) {
  const dir = path.dirname(RESULTS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(RESULTS_PATH, JSON.stringify(obj) + '\n', 'utf8');
  console.log('Result appended to', RESULTS_PATH);
}

async function runOne(name) {
  const r = routes[name];
  if (!r) {
    console.error('Unknown route:', name);
    console.error('Use: health | chat | lesson | story | all');
    process.exit(1);
  }

  const url = API_BASE_URL + r.path;
  const start = Date.now();
  let status;
  let body;
  let error;

  try {
    const opts = {
      method: r.method,
      headers: r.headers,
    };
    if (r.body) opts.body = JSON.stringify(r.body);
    const res = await fetch(url, opts);
    status = res.status;
    const text = await res.text();
    try {
      body = JSON.parse(text);
    } catch {
      body = { _raw: text.slice(0, 500) };
    }
  } catch (e) {
    error = e.message || String(e);
    status = 0;
    body = null;
  }

  const durationMs = Date.now() - start;
  const result = {
    route: name,
    url,
    method: r.method,
    timestamp: new Date().toISOString(),
    status,
    durationMs,
    error: error || null,
    body: body != null ? (body.success === false ? body : { success: body.success, keys: Object.keys(body || {}) }) : null,
  };
  appendResult(result);

  console.log('');
  console.log('---', name.toUpperCase(), '---');
  console.log('Status:', status, '| Duration:', durationMs, 'ms');
  if (error) console.log('Error:', error);
  if (body && body.error) console.log('API error:', body.error);
  if (body && body.userMessage) console.log('User message:', body.userMessage);
  if (body && body.success === true) console.log('Success:', true);
  console.log('');

  return result;
}

async function main() {
  const arg = (process.argv[2] || 'health').toLowerCase();
  console.log('API base:', API_BASE_URL);
  console.log('Route(s):', arg === 'all' ? 'health, chat, lesson, story' : arg);

  if (arg === 'all') {
    for (const name of ['health', 'chat', 'lesson', 'story']) {
      await runOne(name);
    }
  } else {
    await runOne(arg);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
