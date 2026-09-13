-- Street League / PostgreSQL schema for Supabase
create extension if not exists pgcrypto;

create type competition_status as enum ('upcoming','active','finished');
create type match_status as enum ('scheduled','live','finished','postponed');
create type partner_tier as enum ('gold','silver','bronze');
create type event_type as enum ('goal','assist','yellow_card','red_card','substitution','other');
create type social_platform as enum ('youtube','instagram','tiktok');
create type app_role as enum ('viewer','operator','admin','super_admin');

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  username text,
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

create unique index if not exists profiles_username_unique_idx on public.profiles (lower(username)) where username is not null;

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
  name text not null, slug text not null, short_name text, logo_url text, city text, accent_hex text,
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

create or replace view player_event_totals as
select p.id as player_id, p.first_name, p.last_name, p.team_id,
  count(*) filter (where e.event_type='goal')::int as goals,
  count(*) filter (where e.event_type='assist')::int as assists,
  count(*) filter (where e.event_type='yellow_card')::int as yellow_cards,
  count(*) filter (where e.event_type='red_card')::int as red_cards,
  count(*) filter (where e.event_type='other')::int as other_events
from players p left join match_events e on e.player_id=p.id group by p.id;

alter table profiles enable row level security; alter table competitions enable row level security; alter table teams enable row level security;
alter table players enable row level security; alter table matches enable row level security; alter table match_lineups enable row level security;
alter table match_events enable row level security; alter table match_mvp enable row level security; alter table partners enable row level security; alter table social_contents enable row level security;

create or replace function is_staff(required_role app_role default 'operator') returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from profiles p where p.id=auth.uid() and p.is_active = true and (p.role='super_admin' or p.role='admin' or (required_role='operator' and p.role='operator')));
$$;

create or replace function is_super_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from profiles p where p.id=auth.uid() and p.is_active = true and p.role='super_admin');
$$;

-- Public read policies
create policy "public read competitions" on competitions for select using (true);
create policy "public read teams" on teams for select using (true);
create policy "public read players" on players for select using (true);
create policy "public read matches" on matches for select using (true);
create policy "public read lineups" on match_lineups for select using (true);
create policy "public read events" on match_events for select using (true);
create policy "public read mvp" on match_mvp for select using (true);
create policy "public read partners" on partners for select using (true);
create policy "public read social" on social_contents for select using (true);
create policy "users read own profile" on profiles for select using (id=auth.uid());

-- Staff write policies; Admin has CRUD, Operator can manage operational records only.
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
create policy "staff media update" on storage.objects for update to authenticated using (bucket_id='street-league-media' and is_staff('admin')) with check (bucket_id='street-league-media' and is_staff('admin'));
create policy "staff media delete" on storage.objects for delete to authenticated using (bucket_id='street-league-media' and is_staff('admin'));
