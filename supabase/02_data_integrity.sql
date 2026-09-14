-- Street League
-- Migration 02: integrità relazionale e statistiche.
--
-- PREREQUISITO:
-- eseguire prima 01_event_type_foul.sql e fare COMMIT.
--
-- NOTA SULLA VIEW:
-- La view player_event_totals esiste già e contiene la colonna
-- "other_events". CREATE OR REPLACE VIEW non permette di rinominare
-- o riordinare le colonne esistenti. Per questo "other_events" viene
-- mantenuta nella stessa posizione e "fouls" viene aggiunta in coda.

-- ============================================================
-- 1. VINCOLI SEMPLICI
-- ============================================================

alter table public.matches
  drop constraint if exists matches_scores_nonnegative;

alter table public.matches
  add constraint matches_scores_nonnegative
  check (
    (home_score is null or home_score >= 0)
    and (away_score is null or away_score >= 0)
  );

alter table public.match_events
  drop constraint if exists match_events_minute_nonnegative;

alter table public.match_events
  add constraint match_events_minute_nonnegative
  check (minute is null or minute >= 0);

alter table public.match_lineups
  drop constraint if exists match_lineups_shirt_number_nonnegative;

alter table public.match_lineups
  add constraint match_lineups_shirt_number_nonnegative
  check (shirt_number is null or shirt_number >= 0);

alter table public.players
  drop constraint if exists players_shirt_number_nonnegative;

alter table public.players
  add constraint players_shirt_number_nonnegative
  check (shirt_number is null or shirt_number >= 0);

-- ============================================================
-- 2. PARTITE: LE SQUADRE DEVONO APPARTENERE ALLA COMPETIZIONE
-- ============================================================

create or replace function public.validate_match_competition_teams()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  home_competition uuid;
  away_competition uuid;
begin
  select competition_id
    into home_competition
  from public.teams
  where id = new.home_team_id;

  select competition_id
    into away_competition
  from public.teams
  where id = new.away_team_id;

  if home_competition is null or away_competition is null then
    raise exception 'Le squadre della partita non esistono.';
  end if;

  if home_competition <> new.competition_id
     or away_competition <> new.competition_id then
    raise exception
      'Le squadre di una partita devono appartenere alla stessa competizione.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_match_competition_teams
on public.matches;

create trigger trg_validate_match_competition_teams
before insert or update on public.matches
for each row
execute function public.validate_match_competition_teams();

-- ============================================================
-- 3. FORMAZIONI: TEAM E PLAYER DEVONO ESSERE COERENTI
-- ============================================================

create or replace function public.validate_match_lineup_relation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  match_home uuid;
  match_away uuid;
  player_team uuid;
begin
  select home_team_id, away_team_id
    into match_home, match_away
  from public.matches
  where id = new.match_id;

  if match_home is null then
    raise exception 'Partita non trovata.';
  end if;

  if new.team_id <> match_home
     and new.team_id <> match_away then
    raise exception
      'La squadra della formazione non appartiene alla partita.';
  end if;

  select team_id
    into player_team
  from public.players
  where id = new.player_id;

  if player_team is null then
    raise exception 'Giocatore non trovato.';
  end if;

  if player_team <> new.team_id then
    raise exception
      'Il giocatore non appartiene alla squadra della formazione.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_match_lineup_relation
on public.match_lineups;

create trigger trg_validate_match_lineup_relation
before insert or update on public.match_lineups
for each row
execute function public.validate_match_lineup_relation();

-- ============================================================
-- 4. EVENTI: I GIOCATORI DEVONO APPARTENERE AL MATCH
-- ============================================================

create or replace function public.validate_match_event_relation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  match_home uuid;
  match_away uuid;
  actor_team uuid;
  related_team uuid;
begin
  select home_team_id, away_team_id
    into match_home, match_away
  from public.matches
  where id = new.match_id;

  if match_home is null then
    raise exception 'Partita non trovata.';
  end if;

  if new.player_id is not null then
    select team_id
      into actor_team
    from public.players
    where id = new.player_id;

    if actor_team is null
       or (actor_team <> match_home and actor_team <> match_away) then
      raise exception
        'Il giocatore dell''evento non appartiene alle squadre della partita.';
    end if;
  end if;

  if new.related_player_id is not null then
    select team_id
      into related_team
    from public.players
    where id = new.related_player_id;

    if related_team is null
       or (related_team <> match_home and related_team <> match_away) then
      raise exception
        'Il giocatore correlato non appartiene alle squadre della partita.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_match_event_relation
on public.match_events;

create trigger trg_validate_match_event_relation
before insert or update on public.match_events
for each row
execute function public.validate_match_event_relation();

-- ============================================================
-- 5. MVP: IL GIOCATORE DEVE APPARTENERE AL MATCH
-- ============================================================

create or replace function public.validate_match_mvp_relation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  match_home uuid;
  match_away uuid;
  player_team uuid;
begin
  select home_team_id, away_team_id
    into match_home, match_away
  from public.matches
  where id = new.match_id;

  if match_home is null then
    raise exception 'Partita non trovata.';
  end if;

  select team_id
    into player_team
  from public.players
  where id = new.player_id;

  if player_team is null
     or (player_team <> match_home and player_team <> match_away) then
    raise exception
      'Il giocatore MVP non appartiene alle squadre della partita.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_match_mvp_relation
on public.match_mvp;

create trigger trg_validate_match_mvp_relation
before insert or update on public.match_mvp
for each row
execute function public.validate_match_mvp_relation();

-- ============================================================
-- 6. INDICI
-- ============================================================

create index if not exists idx_teams_competition
  on public.teams(competition_id);

create index if not exists idx_match_lineups_match_team
  on public.match_lineups(match_id, team_id);

create index if not exists idx_match_events_match_player
  on public.match_events(match_id, player_id);

create index if not exists idx_match_mvp_player
  on public.match_mvp(player_id);

-- ============================================================
-- 7. VIEW STATISTICHE
-- ============================================================
-- IMPORTANTE:
-- manteniamo tutte le colonne originali nella stessa posizione:
-- player_id, first_name, last_name, team_id, goals, assists,
-- yellow_cards, red_cards, other_events
-- e aggiungiamo fouls come ultima colonna.

create or replace view public.player_event_totals as
select
  p.id as player_id,
  p.first_name,
  p.last_name,
  p.team_id,
  count(*) filter (where e.event_type = 'goal')::int as goals,
  count(*) filter (where e.event_type = 'assist')::int as assists,
  count(*) filter (where e.event_type = 'yellow_card')::int as yellow_cards,
  count(*) filter (where e.event_type = 'red_card')::int as red_cards,
  count(*) filter (where e.event_type = 'other')::int as other_events,
  count(*) filter (where e.event_type = 'foul')::int as fouls
from public.players p
left join public.match_events e
  on e.player_id = p.id
group by
  p.id,
  p.first_name,
  p.last_name,
  p.team_id;
