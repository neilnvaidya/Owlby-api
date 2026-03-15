#!/usr/bin/env node
/**
 * API route tests — hit api-dev.owlby.com to test real handlers (auth, validation, AI).
 * Runs one route, waits for response, then the next (sequential). Results append to api-test-results.jsonl for dataset building.
 *
 * Test all routes (one after another):
 *   node scripts/api-route-test.js
 *   node scripts/api-route-test.js all
 *
 * Test a single route:
 *   node scripts/api-route-test.js health
 *   node scripts/api-route-test.js chat
 *   node scripts/api-route-test.js lesson
 *   node scripts/api-route-test.js story
 *   node scripts/api-route-test.js tags
 *
 * Set OWLBY_TEST_TOKEN in env for chat/lesson/story/tags (Supabase JWT). Health needs no token.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { API_BASE_URL, AUTH_TOKEN, RESULTS_FILE, pickRandomSet } from './api-route-test-config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_PATH = path.resolve(__dirname, RESULTS_FILE);

function buildRoutes(promptSet) {
  const authHeader = AUTH_TOKEN ? `Bearer ${AUTH_TOKEN}` : '';
  return {
    health: {
      method: 'GET',
      path: '/api/profile?scope=health',
      headers: {},
    },
    chat: {
      method: 'POST',
      path: '/api/chat/generate-response',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: {
        messages: [{ role: 'user', text: promptSet.chat.message }],
        chatId: 'test-chat-' + Date.now(),
        gradeLevel: promptSet.chat.gradeLevel,
      },
    },
    lesson: {
      method: 'POST',
      path: '/api/learn/generate-lesson',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: {
        topic: promptSet.lesson.topic,
        gradeLevel: promptSet.lesson.gradeLevel,
        tags: promptSet.lesson.tags,
      },
    },
    story: {
      method: 'POST',
      path: '/api/story/generate-story',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: {
        prompt: promptSet.story.prompt,
        gradeLevel: promptSet.story.gradeLevel,
        tags: promptSet.story.tags,
      },
    },
    tags: {
      method: 'POST',
      path: '/api/tags/generate-tags',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: {
        context: `${promptSet.chat.message}. ${promptSet.lesson.topic}`,
        source: 'chat',
      },
    },
  };
}

function appendResult(obj) {
  const dir = path.dirname(RESULTS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(RESULTS_PATH, JSON.stringify(obj) + '\n', 'utf8');
  console.log('Result appended to', RESULTS_PATH);
}

async function runOne(name, routes, opts = {}) {
  const r = routes[name];
  if (!r) {
    console.error('Unknown route:', name);
    console.error('Use: health | chat | lesson | story | tags | all');
    process.exit(1);
  }

  const url = API_BASE_URL + r.path;
  const start = Date.now();
  let status;
  let body;
  let error;

  try {
    const fetchOpts = {
      method: r.method,
      headers: r.headers,
    };
    if (r.body) fetchOpts.body = JSON.stringify(r.body);
    const res = await fetch(url, fetchOpts);
    status = res.status;
    const text = await res.text();
    try {
      body = JSON.parse(text);
    } catch {
      body = { _raw: text };
    }
  } catch (e) {
    error = e.message || String(e);
    status = 0;
    body = null;
  }

  const durationMs = Date.now() - start;
  const result = {
    route: name,
    ...(opts.promptSetId != null && { promptSetId: opts.promptSetId }),
    url,
    method: r.method,
    timestamp: new Date().toISOString(),
    status,
    durationMs,
    error: error || null,
    body: body ?? null,
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

const ROUTE_ORDER = ['health', 'chat', 'lesson', 'story', 'tags'];

async function main() {
  const arg = (process.argv[2] || 'all').toLowerCase();
  const runAll = arg === 'all';
  const routesToRun = runAll ? ROUTE_ORDER : [arg];

  if (routesToRun[0] && !routesToRun[0].match(/^(health|chat|lesson|story|tags)$/)) {
    console.error('Unknown route:', routesToRun[0]);
    console.error('Use: health | chat | lesson | story | tags | all (or no arg to run all)');
    process.exit(1);
  }

  const promptSet = pickRandomSet();
  const routes = buildRoutes(promptSet);

  console.log('API base:', API_BASE_URL);
  console.log('Prompt set:', promptSet.id, '—', promptSet.chat.message.slice(0, 40) + (promptSet.chat.message.length > 40 ? '…' : ''));
  console.log('Routes (sequential):', routesToRun.join(' → '));
  if (!AUTH_TOKEN && routesToRun.some((r) => r !== 'health')) {
    console.log('(Set OWLBY_TEST_TOKEN for chat/lesson/story or those will return 401)');
  }
  console.log('');

  const results = [];
  for (let i = 0; i < routesToRun.length; i++) {
    const name = routesToRun[i];
    console.log(`[ ${i + 1}/${routesToRun.length} ] ${name}`);
    results.push(await runOne(name, routes, { promptSetId: promptSet.id }));
  }

  console.log('--- DONE ---');
  console.log('Results appended to:', RESULTS_PATH);
  console.log('Summary:', results.map((r) => `${r.route}=${r.status} (${r.durationMs}ms)`).join(' | '));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
