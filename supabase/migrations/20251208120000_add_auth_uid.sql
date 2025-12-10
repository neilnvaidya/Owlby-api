-- Add Supabase auth UID support
alter table public.users
  add column if not exists auth_uid text,
  add constraint users_auth_uid_unique unique (auth_uid);

-- Backfill auth_uid from legacy auth0_id if present
update public.users
set auth_uid = auth0_id
where auth_uid is null and auth0_id is not null;

create index if not exists users_auth_uid_idx on public.users(auth_uid);

