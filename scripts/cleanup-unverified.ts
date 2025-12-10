import { supabase } from '../lib/supabase';

async function run() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('users')
    .delete()
    .is('email_verified_at', null)
    .lt('created_at', cutoff)
    .select('id, email');

  if (error) {
    console.error('Cleanup failed:', error);
    process.exit(1);
  }

  console.info(`Deleted ${data?.length || 0} stale unverified users older than 30 days.`);
  process.exit(0);
}

run();



