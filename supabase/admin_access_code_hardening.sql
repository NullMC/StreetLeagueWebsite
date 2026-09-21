-- Street League: harden admin access-code flow.
-- Safe to run after admin_access_code_migration.sql.

create extension if not exists pgcrypto with schema extensions;

-- Keep profile email synchronized for every newly created Supabase Auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, email, full_name, role, is_active)
  values (
    new.id,
    nullif(lower(new.raw_user_meta_data->>'username'), ''),
    nullif(lower(new.email), ''),
    nullif(new.raw_user_meta_data->>'full_name', ''),
    'viewer',
    true
  )
  on conflict (id) do update
    set email = coalesce(excluded.email, public.profiles.email),
        username = coalesce(excluded.username, public.profiles.username),
        full_name = coalesce(excluded.full_name, public.profiles.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- An access code is a back-office credential, so only staff profiles can
-- satisfy the credential verification RPC.
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
    and p.role in ('super_admin', 'admin', 'operator')
    and extensions.crypt(trim(p_code), c.code_hash) = c.code_hash;

  update public.admin_access_codes c
  set last_used_at = now()
  from public.profiles p
  where c.profile_id = p.id
    and lower(p.username) = lower(trim(p_username))
    and p.is_active = true
    and p.role in ('super_admin', 'admin', 'operator')
    and extensions.crypt(trim(p_code), c.code_hash) = c.code_hash;
end;
$$;

revoke all on function public.verify_admin_access_code(text, text) from public, anon, authenticated;
grant execute on function public.verify_admin_access_code(text, text) to service_role;
