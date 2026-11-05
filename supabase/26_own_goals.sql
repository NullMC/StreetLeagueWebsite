-- Street League: autogol nel referto arbitrale.
-- Run AFTER migration 25. Existing events stay untouched.
--
-- An own goal is recorded for the team that scored it into its own net
-- (match_events.team_id); the goal goes to the opponent. The author is optional:
-- a registered member in the lineup, the team Wildcard, or nobody.
-- Own goals never count as goals in the player rankings.

alter type public.event_type add value if not exists 'own_goal';

alter table public.match_events
  add column if not exists team_id uuid references public.teams(id) on delete cascade;

create or replace function public.validate_street_match_report_event()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_match record;
  v_player record;
  v_wildcard record;
begin
  if new.event_type::text not in ('goal', 'own_goal', 'presidential_penalty', 'yellow_card', 'red_card') then
    raise exception 'Sono ammessi soltanto gol, autogol, rigori presidenziali e cartellini';
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
  if new.player_id is not null and new.wildcard_id is not null then
    raise exception 'Un evento appartiene a un giocatore oppure alla Wildcard, non a entrambi';
  end if;

  -- Own goal: the team is required, the author is optional.
  if new.event_type::text = 'own_goal' then
    if new.team_id is null or new.team_id not in (v_match.home_team_id, v_match.away_team_id) then
      raise exception 'Indica la squadra che ha segnato l''autogol';
    end if;
    if new.wildcard_id is not null then
      select id, team_id into v_wildcard from public.match_wildcards
      where id = new.wildcard_id and match_id = new.match_id;
      if v_wildcard.id is null or v_wildcard.team_id <> new.team_id then
        raise exception 'La Wildcard deve giocare per la squadra dell''autogol';
      end if;
    elsif new.player_id is not null then
      if not exists (
        select 1 from public.match_lineups
        where match_id = new.match_id and player_id = new.player_id and team_id = new.team_id
      ) then
        raise exception 'L''autore dell''autogol deve essere in formazione con la sua squadra';
      end if;
    end if;
    return new;
  end if;

  -- Other events never carry a team of their own: it follows the author.
  new.team_id := null;

  -- Wildcard of the match: goals and cards, never the presidential goal.
  if new.wildcard_id is not null then
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
