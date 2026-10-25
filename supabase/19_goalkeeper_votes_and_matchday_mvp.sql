-- Match-specific goalkeeper ratings and one MVP nomination per competition matchday.
-- Run this migration once in the Supabase SQL Editor before using the new admin panel.

create table if not exists public.goalkeeper_match_ratings (
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

create index if not exists goalkeeper_match_ratings_player_idx
  on public.goalkeeper_match_ratings(player_id);

create table if not exists public.competition_matchday_mvp (
  competition_id uuid not null references public.competitions(id) on delete cascade,
  matchday text not null check (length(btrim(matchday)) > 0),
  player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (competition_id, matchday)
);

create index if not exists competition_matchday_mvp_player_idx
  on public.competition_matchday_mvp(player_id);

-- Guard integrity even if someone bypasses the frontend form.
create or replace function public.validate_goalkeeper_match_rating()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_match record;
  v_player record;
begin
  select id, status, home_team_id, away_team_id into v_match
    from public.matches where id = new.match_id;
  select id, team_id, position, role into v_player
    from public.players where id = new.player_id;

  if v_match.id is null or v_player.id is null then
    raise exception 'Partita o portiere inesistente';
  end if;
  if v_match.status <> 'finished' then
    raise exception 'Puoi votare un portiere solo dopo che la partita è terminata';
  end if;
  if v_player.team_id not in (v_match.home_team_id, v_match.away_team_id) then
    raise exception 'Il portiere deve appartenere a una squadra della partita';
  end if;
  if upper(coalesce(v_player.role, '')) = 'STAFF'
    or not (
      lower(coalesce(v_player.position, '')) like '%portier%'
      or lower(coalesce(v_player.position, '')) like '%goalkeeper%'
      or lower(coalesce(v_player.position, '')) like '%goalie%'
      or lower(btrim(coalesce(v_player.position, ''))) in ('gk', 'por')
    ) then
    raise exception 'Il giocatore selezionato non ha il ruolo di portiere';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_validate_goalkeeper_match_rating
  on public.goalkeeper_match_ratings;
create trigger trg_validate_goalkeeper_match_rating
before insert or update on public.goalkeeper_match_ratings
for each row execute function public.validate_goalkeeper_match_rating();

create or replace function public.validate_competition_matchday_mvp()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_player record;
begin
  new.matchday := btrim(new.matchday);
  if not exists (
    select 1 from public.competitions
    where id = new.competition_id and status = 'active'
  ) then
    raise exception 'Le nomination sono consentite soltanto per competizioni attive';
  end if;
  if not exists (
    select 1 from public.matches
    where competition_id = new.competition_id
      and btrim(coalesce(matchday, '')) = new.matchday
      and status = 'finished'
  ) then
    raise exception 'La giornata selezionata non comprende partite terminate';
  end if;
  select id, team_id, position, role into v_player
    from public.players where id = new.player_id;
  if v_player.id is null or
    upper(coalesce(v_player.position, '')) = 'STAFF' or
    upper(coalesce(v_player.role, '')) = 'STAFF' then
    raise exception 'Seleziona un giocatore valido, non un membro staff';
  end if;
  if not exists (
    select 1 from public.competition_teams
    where competition_id = new.competition_id
      and team_id = v_player.team_id
  ) then
    raise exception 'Il giocatore non è iscritto alla competizione';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_validate_competition_matchday_mvp
  on public.competition_matchday_mvp;
create trigger trg_validate_competition_matchday_mvp
before insert or update on public.competition_matchday_mvp
for each row execute function public.validate_competition_matchday_mvp();

alter table public.goalkeeper_match_ratings enable row level security;
alter table public.competition_matchday_mvp enable row level security;

drop policy if exists "public read goalkeeper ratings" on public.goalkeeper_match_ratings;
create policy "public read goalkeeper ratings"
  on public.goalkeeper_match_ratings for select using (true);

drop policy if exists "admin manage goalkeeper ratings" on public.goalkeeper_match_ratings;
create policy "admin manage goalkeeper ratings"
  on public.goalkeeper_match_ratings for all to authenticated
  using (public.is_staff('admin'))
  with check (public.is_staff('admin'));

drop policy if exists "public read matchday mvp" on public.competition_matchday_mvp;
create policy "public read matchday mvp"
  on public.competition_matchday_mvp for select using (true);

drop policy if exists "admin manage matchday mvp" on public.competition_matchday_mvp;
create policy "admin manage matchday mvp"
  on public.competition_matchday_mvp for all to authenticated
  using (public.is_staff('admin'))
  with check (public.is_staff('admin'));

grant select on public.goalkeeper_match_ratings, public.competition_matchday_mvp to anon;
grant select, insert, update, delete on public.goalkeeper_match_ratings, public.competition_matchday_mvp to authenticated;

notify pgrst, 'reload schema';
