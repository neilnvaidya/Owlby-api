/**
 * Config for API route tests (scripts/api-route-test.js).
 * Tests hit the live API; no app or simulator required.
 */

// Base URL for the API (development).
const API_BASE_URL = 'https://api-dev.owlby.com';

// Auth: set OWLBY_TEST_TOKEN in env, or paste a valid Supabase JWT for testing.
// Chat, lesson, and story routes require Authorization: Bearer <token>.
const AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsImtpZCI6Iml0aFh4K2dJWDgzTVNjSzMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL294cWlxdnl4cmNycXVmd2RvdnJ2LnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI2YjRhNTU4Ni0wM2EwLTQ2NjItYTJlZS01YjE0MGU2NDFkYmIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzczNTQ3Mzc3LCJpYXQiOjE3NzM1NDU1NzcsImVtYWlsIjoidGVzdDFAb3dsYnkuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJlbWFpbCI6InRlc3QxQG93bGJ5LmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmdWxsX25hbWUiOiIiLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInN1YiI6IjZiNGE1NTg2LTAzYTAtNDY2Mi1hMmVlLTViMTQwZTY0MWRiYiJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzczNTQ1NTc3fV0sInNlc3Npb25faWQiOiI0ODQxNDU4Mi0zZjg4LTRhMjMtYmNlMC04MjE1YWYxMTYzZGYiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.7EeVXVdJomUG2s8mZmCTeNtijh8lACokcv3uvNBqA70";

// Where to append test results (one JSON object per line), relative to scripts/.
const RESULTS_FILE = 'api-test-results.jsonl';

module.exports = {
  API_BASE_URL,
  AUTH_TOKEN,
  RESULTS_FILE,
};
