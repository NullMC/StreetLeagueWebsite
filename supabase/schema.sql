-- Street League / PostgreSQL schema for Supabase
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create type competition_status as enum ('upcoming','active','finished');
create type match_status as enum ('scheduled','live','finished','postponed');
create type partner_tier as enum ('gold','silver','bronze');
create type event_type as enum ('goal','assist','yellow_card','red_card','substitution','foul','presidential_penalty','other');
create type social_platform as enum ('youtube','instagram','tiktok');
create type app_role as enum ('viewer','operator','admin','super_admin');

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  username text,
  email text,
  role app_role not null default 'viewer',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

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

create unique index if not exists profiles_username_unique_idx on public.profiles (lower(username)) where username is not null;
create unique index if not exists profiles_email_unique_idx on public.profiles (lower(email)) where email is not null;

create table if not exists competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status competition_status not null default 'upcoming',
  season_label text,
  start_date date,
  end_date date,
  hero_image_url text,
  created_at timestamptz not null default now()
);
create table if not exists teams (
  id uuid primary key default gen_random_uuid(), competition_id uuid not null references competitions(id) on delete cascade,
  name text not null, slug text not null, logo_url text, accent_hex text,
  created_at timestamptz not null default now(), unique(competition_id,slug)
);
create table if not exists players (
  id uuid primary key default gen_random_uuid(), team_id uuid not null references teams(id) on delete cascade,
  first_name text not null, last_name text not null, shirt_number integer, position text,
  profile_image_url text, bg_less_image_url text, created_at timestamptz not null default now()
);
create table if not exists matches (
  id uuid primary key default gen_random_uuid(), competition_id uuid not null references competitions(id) on delete cascade,
  home_team_id uuid not null references teams(id), away_team_id uuid not null references teams(id),
  matchday text, kickoff_at timestamptz not null, status match_status not null default 'scheduled',
  home_score integer, away_score integer, venue text, created_at timestamptz not null default now(),
  constraint different_teams check (home_team_id <> away_team_id)
);
create table if not exists match_lineups (
  id uuid primary key default gen_random_uuid(), match_id uuid not null references matches(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade, player_id uuid not null references players(id) on delete cascade,
  starter boolean not null default true, shirt_number integer, created_at timestamptz not null default now(),
  unique(match_id,player_id)
);
create table if not exists match_events (
  id uuid primary key default gen_random_uuid(), match_id uuid not null references matches(id) on delete cascade,
  player_id uuid references players(id) on delete set null, related_player_id uuid references players(id) on delete set null,
  event_type event_type not null, minute integer, note text, created_at timestamptz not null default now()
);
create table if not exists match_mvp (
  match_id uuid primary key references matches(id) on delete cascade, player_id uuid not null references players(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists partners (
  id uuid primary key default gen_random_uuid(), name text not null, tier partner_tier not null,
  logo_url text, website_url text, sort_order integer not null default 0, created_at timestamptz not null default now()
);
create table if not exists social_contents (
  id uuid primary key default gen_random_uuid(), platform social_platform not null, title text not null,
  thumbnail_url text, content_url text not null, published_at timestamptz, created_at timestamptz not null default now()
);

create index if not exists idx_matches_competition_kickoff on matches(competition_id,kickoff_at);
create index if not exists idx_events_match on match_events(match_id);
create index if not exists idx_players_team on players(team_id);
create table if not exists active_collaborations (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Collaborazione attiva',
  description text not null default '',
  flyer_url text,
  cta_url text,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create table if not exists player_of_month (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  month_label text not null,
  note text,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (month_label)
);

create index if not exists active_collaborations_sort_idx on active_collaborations(sort_order, created_at);
create index if not exists idx_player_of_month_published_at on player_of_month(published_at desc);

create or replace view player_event_totals as
select p.id as player_id, p.first_name, p.last_name, p.team_id,
  count(*) filter (where e.event_type='goal')::int as goals,
  count(*) filter (where e.event_type='assist')::int as assists,
  count(*) filter (where e.event_type='yellow_card')::int as yellow_cards,
  count(*) filter (where e.event_type='red_card')::int as red_cards,
  count(*) filter (where e.event_type='other')::int as other_events,
  count(*) filter (where e.event_type='foul')::int as fouls
from players p left join match_events e on e.player_id=p.id group by p.id;

alter table profiles enable row level security;
alter table active_collaborations enable row level security;
alter table player_of_month enable row level security; alter table competitions enable row level security; alter table teams enable row level security;
alter table players enable row level security; alter table matches enable row level security; alter table match_lineups enable row level security;
alter table match_events enable row level security; alter table match_mvp enable row level security; alter table partners enable row level security; alter table social_contents enable row level security;

create or replace function is_staff(required_role app_role default 'operator') returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from profiles p where p.id=auth.uid() and p.is_active = true and (p.role='super_admin' or p.role='admin' or (required_role='operator' and p.role='operator')));
$$;

create or replace function is_super_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from profiles p where p.id=auth.uid() and p.is_active = true and p.role='super_admin');
$$;

create policy "public read competitions" on competitions for select using (true);
create policy "public read teams" on teams for select using (true);
create policy "public read players" on players for select using (true);
create policy "public read matches" on matches for select using (true);
create policy "public read lineups" on match_lineups for select using (true);
create policy "public read events" on match_events for select using (true);
create policy "public read mvp" on match_mvp for select using (true);
create policy "public read partners" on partners for select using (true);
create policy "public read social" on social_contents for select using (true);
create policy "public active collaborations read" on active_collaborations for select using (true);
create policy "admin manage active collaborations" on active_collaborations for all using (is_staff('admin')) with check (is_staff('admin'));
create policy "public player of month read" on player_of_month for select using (true);
create policy "admin manage player of month" on player_of_month for all using (is_staff('admin'));
create policy "users read own profile" on profiles for select using (id=auth.uid());

create policy "admin manage competitions" on competitions for all using (is_staff('admin')) with check (is_staff('admin'));
create policy "admin manage teams" on teams for all using (is_staff('admin')) with check (is_staff('admin'));
create policy "admin manage players" on players for all using (is_staff('admin')) with check (is_staff('admin'));
create policy "staff manage matches" on matches for all using (is_staff('operator')) with check (is_staff('operator'));
create policy "staff manage lineups" on match_lineups for all using (is_staff('operator')) with check (is_staff('operator'));
create policy "staff manage events" on match_events for all using (is_staff('operator')) with check (is_staff('operator'));
create policy "staff manage mvp" on match_mvp for all using (is_staff('operator')) with check (is_staff('operator'));
create policy "admin manage partners" on partners for all using (is_staff('admin')) with check (is_staff('admin'));
create policy "admin manage social" on social_contents for all using (is_staff('admin')) with check (is_staff('admin'));

insert into storage.buckets (id, name, public) values ('street-league-media','street-league-media',true) on conflict (id) do update set public = excluded.public;
create policy "public media read" on storage.objects for select using (bucket_id='street-league-media');
create policy "staff media insert" on storage.objects for insert to authenticated with check (bucket_id='street-league-media' and is_staff('admin'));
create policy "staff media update" on storage.objects for update to authenticated using (bucket_id='street-league-media' and is_staff('admin'));
create policy "staff media delete" on storage.objects for delete to authenticated using (bucket_id='street-league-media' and is_staff('admin'));

create table if not exists public.admin_access_codes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists admin_access_codes_profile_idx on public.admin_access_codes(profile_id);
alter table public.admin_access_codes enable row level security;
revoke all on public.admin_access_codes from anon, authenticated;

create or replace function public.set_admin_access_code(p_user_id uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_code is null or length(trim(p_code)) < 8 then
    raise exception 'Access code must contain at least 8 characters';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Profile not found';
  end if;
  insert into public.admin_access_codes (profile_id, code_hash)
  values (p_user_id, extensions.crypt(trim(p_code), extensions.gen_salt('bf', 12)))
  on conflict (profile_id)
  do update set code_hash = excluded.code_hash, updated_at = now();
end;
$$;

create or replace function public.verify_admin_access_code(p_username text, p_code text)
returns table (user_id uuid, email text, full_name text, username text, role app_role, is_active boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_username is null or p_code is null then return; end if;

  return query
  select p.id, p.email, p.full_name, p.username, p.role, p.is_active
  from public.profiles p
  join public.admin_access_codes c on c.profile_id = p.id
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

revoke all on function public.set_admin_access_code(uuid, text) from public, anon, authenticated;
revoke all on function public.verify_admin_access_code(text, text) from public, anon, authenticated;
grant execute on function public.set_admin_access_code(uuid, text) to service_role;
grant execute on function public.verify_admin_access_code(text, text) to service_role;
