-- Fix: verify_admin_access_code returned app_role while the function contract expects text.
-- PostgreSQL requires exact return types for functions returning TABLE.
-- Run this migration in Supabase SQL Editor.

create or replace function public.verify_admin_access_code(
  p_username text,
  p_code text
)
returns table (
  id uuid,
  full_name text,
  username text,
  email text,
  role text,
  is_active boolean
)
security definer
set search_path = public
as $$
begin
  return query
  select
    p.id,
    p.full_name,
    p.username,
    p.email,
    p.role::text,
    p.is_active
  from public.profiles p
  where lower(p.username) = lower(p_username)
    and p.is_active = true
    and p.access_code = p_code;
end;
$$;
