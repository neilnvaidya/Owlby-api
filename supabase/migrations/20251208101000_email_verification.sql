-- Email verification support
alter table public.users
  add column if not exists email_verified_at timestamptz,
  add column if not exists verified_via text,
  add column if not exists onboarding_completed_at timestamptz;

create table if not exists public.email_verification_tokens (
  jti text primary key,
  user_id integer references public.users(id) on delete cascade,
  purpose text not null default 'email-verify',
  expires_at timestamptz not null,
  issued_at timestamptz not null default timezone('utc', now()),
  consumed_at timestamptz
);

create index if not exists email_verification_tokens_user_idx on public.email_verification_tokens(user_id);
create index if not exists email_verification_tokens_expires_idx on public.email_verification_tokens(expires_at);

