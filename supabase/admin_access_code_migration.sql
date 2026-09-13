-- Street League: permanent access codes for staff accounts.
-- Safe migration: no existing application tables are dropped.
-- Run this file AFTER the app_role enum already contains super_admin.

create extension if not exists pgcrypto with schema extensions;

alter table public.profiles
  add column if not exists email text;

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email))
  where email is not null;

create table if not exists public.admin_access_codes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz null
);

create index if not exists admin_access_codes_profile_idx
  on public.admin_access_codes(profile_id);

alter table public.admin_access_codes enable row level security;

revoke all on public.admin_access_codes from anon, authenticated;

create or replace function public.set_admin_access_code(
  p_user_id uuid,
  p_code text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_code is null or length(trim(p_code)) < 8 then
    raise exception 'Access code must contain at least 8 characters';
  end if;

  if not exists (
    select 1 from public.profiles where id = p_user_id
  ) then
    raise exception 'Profile not found';
  end if;

  insert into public.admin_access_codes (profile_id, code_hash, created_at, updated_at)
  values (
    p_user_id,
    extensions.crypt(trim(p_code), extensions.gen_salt('bf', 12)),
    now(),
    now()
  )
  on conflict (profile_id)
  do update set
    code_hash = excluded.code_hash,
    updated_at = now();
end;
$$;

create or replace function public.verify_admin_access_code(
  p_username text,
  p_code text
)
returns table (
  user_id uuid,
  email text,
  full_name text,
  username text,
  role app_role,
  is_active boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_username is null or p_code is null then
    return;
  end if;

  return query
  select
    p.id,
    p.email,
    p.full_name,
    p.username,
    p.role,
    p.is_active
  from public.profiles p
  join public.admin_access_codes c
    on c.profile_id = p.id
  where lower(p.username) = lower(trim(p_username))
    and p.is_active = true
    and extensions.crypt(trim(p_code), c.code_hash) = c.code_hash;

  update public.admin_access_codes c
  set last_used_at = now()
  from public.profiles p
  where c.profile_id = p.id
    and lower(p.username) = lower(trim(p_username))
    and p.is_active = true
    and extensions.crypt(trim(p_code), c.code_hash) = c.code_hash;
end;
$$;

revoke all on function public.set_admin_access_code(uuid, text) from public, anon, authenticated;
revoke all on function public.verify_admin_access_code(text, text) from public, anon, authenticated;
grant execute on function public.set_admin_access_code(uuid, text) to service_role;
grant execute on function public.verify_admin_access_code(text, text) to service_role;

-- Keep staff profile emails available to the frontend only for the signed-in user.
drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile"
  on public.profiles for select
  using (id = auth.uid());
