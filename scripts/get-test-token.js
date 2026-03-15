/**
 * Get a Supabase JWT for API route testing.
 * Usage:
 *   node scripts/get-test-token.js
 * Requires in env (or .env): SUPABASE_URL, SUPABASE_ANON_KEY,
 * and TEST_USER_EMAIL, TEST_USER_PASSWORD for a real user in your project.
 *
 * Then: export OWLBY_TEST_TOKEN='<printed-token>' && node scripts/api-route-test.js chat
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.TEST_USER_EMAIL;
const password = process.env.TEST_USER_PASSWORD;

if (!supabaseUrl || !supabaseAnon) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY in .env');
  process.exit(1);
}
if (!email || !password) {
  console.error('Set TEST_USER_EMAIL and TEST_USER_PASSWORD in .env for a test user');
  process.exit(1);
}

async function main() {
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseAnon);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('Sign-in failed:', error.message);
    process.exit(1);
  }
  const token = data?.session?.access_token;
  if (!token) {
    console.error('No access_token in session');
    process.exit(1);
  }
  console.log('Copy this token and set OWLBY_TEST_TOKEN or paste into api-route-test-config.js:\n');
  console.log(token);
}

main();
