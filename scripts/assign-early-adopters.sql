-- Assign early adopter status to specific users.
-- Edit the WHERE clause to match your early adopters, then run against Supabase SQL Editor.
--
-- Option A: by email
UPDATE public.users
SET is_early_adopter = true
WHERE email IN (
  -- Add early adopter emails here:
  -- 'alice@example.com',
  -- 'bob@example.com'
);

-- Option B: by auth_uid
-- UPDATE public.users
-- SET is_early_adopter = true
-- WHERE auth_uid IN (
--   'uid-1',
--   'uid-2'
-- );

-- Verify:
-- SELECT auth_uid, email, is_early_adopter FROM public.users WHERE is_early_adopter = true;
