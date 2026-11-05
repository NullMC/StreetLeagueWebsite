-- Street League: the match Wildcard in the referee report.
-- Run AFTER migration 24. Existing events stay untouched.
--
-- A Wildcard can score and be booked: the event points to the Wildcard of the
-- match (match_wildcards) instead of a registered player. Presidential goals stay
-- reserved to STAFF. Wildcard events count for that match only, so the season
-- rankings (scorers, cards) keep listing registered players.

alter table public.match_events
  add column if not exists wildcard_id uuid references public.match_wildcards(id) on delete cascade;

create index if not exists idx_match_events_wildcard on public.match_events(wildcard_id);

alter table public.match_events drop constraint if exists match_events_player_or_wildcard;
alter table public.match_events
  add constraint match_events_player_or_wildcard check (player_id is null or wildcard_id is null);

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

  -- Wildcard of the match: goals and cards, never the presidential goal.
  if new.wildcard_id is not null then
    if new.player_id is not null then
      raise exception 'Un evento appartiene a un giocatore oppure alla Wildcard, non a entrambi';
    end if;
    if not exists (
      select 1 from public.match_wildcards
      where id = new.wildcard_id and match_id = new.match_id
    ) then
      raise exception 'La Wildcard non appartiene a questa partita';
    end if;
    if new.event_type::text = 'presidential_penalty' then
      raise exception 'I rigori presidenziali richiedono un membro STAFF';
    end if;
    return new;
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
