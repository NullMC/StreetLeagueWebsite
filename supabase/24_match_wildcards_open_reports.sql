-- Street League: Wildcard per squadra, STAFF in formazione e referti sempre modificabili.
-- Run AFTER migration 21. Existing lineups, events, MVPs and ratings stay untouched.
--
-- 1. Each match can have one Wildcard (an external player) per team, with a name
--    and a role. It changes from match to match, so it lives on its own table,
--    one row per match and team. A Wildcard can be the MVP of the match and, when
--    it plays as goalkeeper, receives the end-of-match rating (1-5).
--    Wildcards count for that match only: they are not registered players, so
--    season leaderboards (MVP, goalkeepers) keep listing registered players.
-- 2. Lineups and referee reports can be added, edited and removed at any time,
--    whatever the match status (before, during or after the match).
-- 3. STAFF members can be part of a lineup, so they can receive cards or score
--    with the presidential goal; those events are stored in the report.
--    A regular goal still requires a player, not a STAFF member.

-- Never applied in production; dropped in case a local database has them.
alter table public.matches
  drop column if exists home_wildcard,
  drop column if exists away_wildcard;

create table if not exists public.match_wildcards (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 80),
  position text not null check (position in ('Portiere', 'Difensore', 'Centrocampista', 'Attaccante')),
  goalkeeper_rating smallint check (goalkeeper_rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, team_id)
);

create index if not exists match_wildcards_match_idx on public.match_wildcards(match_id);

create or replace function public.validate_match_wildcard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_match record;
begin
  select id, status, home_team_id, away_team_id into v_match
  from public.matches where id = new.match_id;
  if v_match.id is null then
    raise exception 'Partita non trovata';
  end if;
  if new.team_id not in (v_match.home_team_id, v_match.away_team_id) then
    raise exception 'La Wildcard deve giocare per una delle due squadre della partita';
  end if;
  new.full_name := btrim(new.full_name);
  if new.position <> 'Portiere' then
    new.goalkeeper_rating := null;
  end if;
  if new.goalkeeper_rating is not null
     and (tg_op = 'INSERT' or new.goalkeeper_rating is distinct from old.goalkeeper_rating)
     and v_match.status::text <> 'finished' then
    raise exception 'Puoi votare un portiere solo dopo che la partita è terminata';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_validate_match_wildcard on public.match_wildcards;
create trigger trg_validate_match_wildcard
before insert or update on public.match_wildcards
for each row execute function public.validate_match_wildcard();

alter table public.match_wildcards enable row level security;

drop policy if exists "public read wildcards" on public.match_wildcards;
create policy "public read wildcards"
  on public.match_wildcards for select using (true);

drop policy if exists "staff manage wildcards" on public.match_wildcards;
create policy "staff manage wildcards"
  on public.match_wildcards for all
  using (public.is_staff('operator'))
  with check (public.is_staff('operator'));

grant select on public.match_wildcards to anon;
grant select, insert, update, delete on public.match_wildcards to authenticated;

-- MVP of the match: a registered player or the Wildcard of one of the two teams.
alter table public.match_mvp
  alter column player_id drop not null,
  add column if not exists wildcard_id uuid references public.match_wildcards(id) on delete cascade;

alter table public.match_mvp drop constraint if exists match_mvp_player_or_wildcard;
alter table public.match_mvp
  add constraint match_mvp_player_or_wildcard check (num_nonnulls(player_id, wildcard_id) = 1);

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

  if new.wildcard_id is not null then
    if not exists (
      select 1 from public.match_wildcards
      where id = new.wildcard_id and match_id = new.match_id
    ) then
      raise exception 'La Wildcard MVP non appartiene a questa partita.';
    end if;
    return new;
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

-- Referee report: no match-status lock; STAFF can be booked and score the presidential goal.
create or replace function public.validate_street_match_report_event()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_match record;
  v_player record;
begin
  if new.event_type::text not in ('goal', 'presidential_penalty', 'yellow_card', 'red_card') then
    raise exception 'Sono ammessi soltanto gol, rigori presidenziali e cartellini';
  end if;
  if new.minute is null or new.minute not between 1 and 50 then
    raise exception 'Il minuto deve essere compreso tra 1 e 50';
  end if;
  select id, home_team_id, away_team_id into v_match
  from public.matches where id = new.match_id;
  if v_match.id is null then
    raise exception 'Partita non trovata';
  end if;
  if not exists (
    select 1 from public.match_lineups l
    where l.match_id = new.match_id and l.team_id = v_match.home_team_id
  ) or not exists (
    select 1 from public.match_lineups l
    where l.match_id = new.match_id and l.team_id = v_match.away_team_id
  ) then
    raise exception 'Registra prima entrambe le formazioni';
  end if;

  select id, team_id, position into v_player
  from public.players where id = new.player_id;
  if v_player.id is null or v_player.team_id not in (v_match.home_team_id, v_match.away_team_id) then
    raise exception 'Seleziona un giocatore di una delle due squadre';
  end if;
  if new.event_type::text = 'presidential_penalty' then
    if upper(btrim(coalesce(v_player.position, ''))) <> 'STAFF' then
      raise exception 'I rigori presidenziali richiedono un membro STAFF';
    end if;
  elsif not exists (
    select 1 from public.match_lineups
    where match_id = new.match_id and player_id = new.player_id
  ) then
    raise exception 'Per questo evento seleziona un membro in formazione';
  elsif new.event_type::text = 'goal' and upper(btrim(coalesce(v_player.position, ''))) = 'STAFF' then
    raise exception 'Lo STAFF segna soltanto con il rigore presidenziale';
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
