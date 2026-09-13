-- Street League: Admin platform + remove Home decorations

alter type app_role add value if not exists 'super_admin';

alter table public.profiles
  add column if not exists username text,
  add column if not exists is_active boolean not null default true;

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null;

-- Remove the Home decorations feature entirely.
drop table if exists public.home_decorations cascade;

-- Replace staff helper so super_admin inherits every staff capability.
create or replace function public.is_staff(required_role app_role default 'operator')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and (
        p.role = 'super_admin'
        or p.role = 'admin'
        or (required_role = 'operator' and p.role = 'operator')
      )
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role = 'super_admin'
  );
$$;

-- Admins/operators can read their own profile; super admin can read staff profiles.
drop policy if exists "users read own profile" on public.profiles;
drop policy if exists "super admin read profiles" on public.profiles;
create policy "users read own profile"
  on public.profiles for select
  using (id = auth.uid());
create policy "super admin read profiles"
  on public.profiles for select
  using (public.is_super_admin());

-- Allow super admin to manage profiles created by the management Edge Function if needed.
drop policy if exists "super admin manage profiles" on public.profiles;
create policy "super admin manage profiles"
  on public.profiles for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Storage bucket for player/team/competition/partner/social assets.
insert into storage.buckets (id, name, public)
values ('street-league-media', 'street-league-media', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "public media read" on storage.objects;
drop policy if exists "staff media insert" on storage.objects;
drop policy if exists "staff media update" on storage.objects;
drop policy if exists "staff media delete" on storage.objects;

create policy "public media read"
  on storage.objects for select
  using (bucket_id = 'street-league-media');

create policy "staff media insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'street-league-media' and public.is_staff('admin'));

create policy "staff media update"
  on storage.objects for update to authenticated
  using (bucket_id = 'street-league-media' and public.is_staff('admin'))
  with check (bucket_id = 'street-league-media' and public.is_staff('admin'));

create policy "staff media delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'street-league-media' and public.is_staff('admin'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, role, is_active)
  values (
    new.id,
    nullif(lower(new.raw_user_meta_data->>'username'), ''),
    nullif(new.raw_user_meta_data->>'full_name', ''),
    'viewer',
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
