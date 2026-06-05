/**
 * Config for API route tests (scripts/api-route-test.js).
 * Tests hit the live API; no app or simulator required.
 */

// Base URL for the API (development).
const API_BASE_URL = 'https://api-dev.owlby.com';

// Auth: set OWLBY_TEST_TOKEN in env, or paste a valid Supabase JWT for testing.
// Chat, lesson, and story routes require Authorization: Bearer <token>.
const AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsImtpZCI6Iml0aFh4K2dJWDgzTVNjSzMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL294cWlxdnl4cmNycXVmd2RvdnJ2LnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI2YjRhNTU4Ni0wM2EwLTQ2NjItYTJlZS01YjE0MGU2NDFkYmIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzczNTY4NzM3LCJpYXQiOjE3NzM1NjY5MzcsImVtYWlsIjoidGVzdDFAb3dsYnkuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJlbWFpbCI6InRlc3QxQG93bGJ5LmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmdWxsX25hbWUiOiIiLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInN1YiI6IjZiNGE1NTg2LTAzYTAtNDY2Mi1hMmVlLTViMTQwZTY0MWRiYiJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzczNTY2OTM3fV0sInNlc3Npb25faWQiOiI3YWJiZDc4Yi03YzlkLTRjMzItYjA2Zi1jNzE5OGIxZTA0NWEiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.dzymXSfBFRrmoyYyE0Myy1U3ZXfrfXz-gr8C7Y4w7HI";

// Where to append test results (one JSON object per line), relative to scripts/.
const RESULTS_FILE = 'api-test-results.jsonl';

// 5 prompt sets; the test picks one at random per run. Each set has chat, lesson, and story prompts.
const PROMPT_SETS = [
  {
    id: 1,
    chat: { message: 'What are rainbows?', gradeLevel: 3 },
    lesson: { topic: 'The science of light and color', gradeLevel: 3, tags: ['light', 'rainbows'] },
    story: { prompt: 'a prism catching sunlight', gradeLevel: 3, tags: ['light', 'prism'] },
  },
  {
    id: 2,
    chat: { message: 'How do volcanoes erupt?', gradeLevel: 3 },
    lesson: { topic: 'How volcanoes form and erupt', gradeLevel: 3, tags: ['volcanoes', 'earth'] },
    story: { prompt: 'a kid discovering a glowing rock', gradeLevel: 3, tags: ['adventure', 'science'] },
  },
  {
    id: 3,
    chat: { message: 'Why do we have day and night?', gradeLevel: 4 },
    lesson: { topic: 'Earth’s rotation and day and night', gradeLevel: 4, tags: ['space', 'earth'] },
    story: { prompt: 'the sun and moon having a race', gradeLevel: 4, tags: ['space', 'friendship'] },
  },
  {
    id: 4,
    chat: { message: 'What do bees do for flowers?', gradeLevel: 3 },
    lesson: { topic: 'Pollination and why bees matter', gradeLevel: 3, tags: ['bees', 'plants'] },
    story: { prompt: 'a bee’s first day in the garden', gradeLevel: 3, tags: ['bees', 'nature'] },
  },
  {
    id: 5,
    chat: { message: 'How do fish breathe underwater?', gradeLevel: 3 },
    lesson: { topic: 'How gills work', gradeLevel: 3, tags: ['fish', 'oxygen'] },
    story: { prompt: 'a curious fish exploring the reef', gradeLevel: 3, tags: ['ocean', 'fish'] },
  },
];

function pickRandomSet() {
  return PROMPT_SETS[Math.floor(Math.random() * PROMPT_SETS.length)];
}

export { API_BASE_URL, AUTH_TOKEN, RESULTS_FILE, PROMPT_SETS, pickRandomSet };
