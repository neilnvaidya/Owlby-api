#!/usr/bin/env node
/**
 * Validate every Gemini model ID used by Owlby against the live API.
 *
 * Diagnoses the production AI-generation failure (chat/lesson/story):
 *   - 404 / NOT_FOUND        -> model ID retired/renamed (fix ROUTE_MODEL_CONFIG)
 *   - 401 / 403 / PERMISSION -> GEMINI_API_KEY invalid or lacks access
 *   - 429 / RESOURCE_EXHAUSTED -> quota/billing exhausted
 *   - ok                     -> model reachable with this key
 *
 * Run with the SAME key your production deployment uses:
 *   GEMINI_API_KEY=xxx node scripts/validate-gemini-models.js
 *
 * Covers both the live `main` chain (lib/ai-config.ts) and the `dev` chain
 * (lib/config.ts) so you can confirm dev is safe to deploy before shipping it.
 */

import { GoogleGenAI } from '@google/genai';

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('GEMINI_API_KEY is required. Re-run with the production key:');
  console.error('  GEMINI_API_KEY=xxx node scripts/validate-gemini-models.js');
  process.exit(1);
}

// Union of all model IDs referenced across main (ai-config.ts) and dev (config.ts).
const MODELS = [
  'gemini-2.5-flash',              // GA — fallback terminal on both branches
  'gemini-2.5-pro',               // GA — fallback on main
  'gemini-3-flash-preview',        // preview — primary on main lesson/story
  'gemini-3.1-flash-lite-preview', // preview — primary everywhere on dev
];

const ai = new GoogleGenAI({ apiKey: API_KEY });

function classify(err) {
  const msg = (err && (err.message || String(err))) || '';
  const m = msg.toLowerCase();
  if (m.includes('not found') || m.includes('404')) return 'RETIRED/NOT_FOUND (404)';
  if (m.includes('permission') || m.includes('401') || m.includes('403') || m.includes('api key'))
    return 'AUTH/KEY (401/403)';
  if (m.includes('resource') || m.includes('exhaust') || m.includes('429') || m.includes('quota'))
    return 'QUOTA/BILLING (429)';
  return `OTHER: ${msg.slice(0, 140)}`;
}

async function probe(model) {
  try {
    const r = await ai.models.generateContent({ model, contents: 'ping' });
    const ok = !!(r && (r.text || (Array.isArray(r.candidates) && r.candidates.length)));
    return { model, status: ok ? 'ok' : 'EMPTY_RESPONSE' };
  } catch (err) {
    return { model, status: classify(err) };
  }
}

const results = [];
for (const model of MODELS) {
  process.stdout.write(`Probing ${model} ... `);
  const row = await probe(model);
  console.log(row.status);
  results.push(row);
}

console.log('\n--- Summary ---');
let anyOk = false;
for (const r of results) {
  if (r.status === 'ok') anyOk = true;
  console.log(`${r.status === 'ok' ? '✅' : '❌'} ${r.model.padEnd(32)} ${r.status}`);
}

if (!anyOk) {
  console.log(
    '\nNo model succeeded. If even gemini-2.5-flash fails with AUTH or QUOTA,\n' +
      'the root cause is the GEMINI_API_KEY / billing, not the model IDs.'
  );
  process.exit(1);
}
process.exit(0);
