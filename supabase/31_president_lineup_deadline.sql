-- Street League: le formazioni dei presidenti si chiudono 15 minuti prima del calcio d'inizio.
-- Run AFTER migration 30. Only president_save_lineup() changes (same signature and grants);
-- the super admin keeps editing lineups from the back office at any time, as before.

-- p_players: [{ "player_id": uuid, "starter": boolean }, ...] — field players and STAFF, no goalkeepers.
-- p_keeper_id: registered goalkeeper of the team (always a starter), or null for an external goalkeeper.
-- p_wildcard_name: "Nome Cognome" of the Wildcard, or empty for no Wildcard.
create or replace function public.president_save_lineup(
  p_match_id uuid,
  p_players jsonb,
  p_keeper_id uuid,
  p_wildcard_name text,
  p_wildcard_starter boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team uuid := public.current_president_team();
  v_match record;
  v_count integer;
  v_distinct integer;
  v_valid integer;
  v_field integer;
  v_wildcard text := regexp_replace(btrim(coalesce(p_wildcard_name, '')), '\s+', ' ', 'g');
  v_ids uuid[];
  v_starters boolean[];
begin
  if v_team is null then
    raise exception 'Accesso riservato ai presidenti di squadra.' using errcode = '42501';
  end if;

  -- Lock the match row: kickoff and status cannot change halfway through the save.
  select m.id, m.home_team_id, m.away_team_id, m.status, m.kickoff_at, m.competition_id,
         c.status as competition_status
    into v_match
  from public.matches m
  join public.competitions c on c.id = m.competition_id
  where m.id = p_match_id
  for update of m;

  if v_match.id is null then
    raise exception 'Partita non trovata.';
  end if;
  if v_team not in (v_match.home_team_id, v_match.away_team_id) then
    raise exception 'Puoi registrare soltanto le formazioni della tua squadra.' using errcode = '42501';
  end if;
  if v_match.competition_status::text <> 'active' then
    raise exception 'La competizione di questa partita non è attiva.';
  end if;
  if not exists (
    select 1 from public.competition_teams ct
    where ct.competition_id = v_match.competition_id and ct.team_id = v_team
  ) then
    raise exception 'La tua squadra non è iscritta a questa competizione.' using errcode = '42501';
  end if;
  if v_match.status::text <> 'scheduled' then
    raise exception 'La partita non è più in programma: la formazione non è modificabile.';
  end if;
  -- Presidents close their lineup 15 minutes before kickoff (the super admin has no limit).
  if now() >= v_match.kickoff_at - interval '15 minutes' then
    raise exception 'Tempo scaduto: la formazione si può registrare fino a 15 minuti prima del calcio d''inizio (entro le %).',
      to_char((v_match.kickoff_at - interval '15 minutes') at time zone 'Europe/Rome', 'DD/MM/YYYY HH24:MI');
  end if;

  if p_players is null or jsonb_typeof(p_players) <> 'array' then
    raise exception 'Formato della formazione non valido.';
  end if;
  if jsonb_array_length(p_players) > 60 then
    raise exception 'Troppi membri in formazione.';
  end if;

  begin
    select coalesce(array_agg((e->>'player_id')::uuid), '{}'),
           coalesce(array_agg(coalesce((e->>'starter')::boolean, true)), '{}')
      into v_ids, v_starters
    from jsonb_array_elements(p_players) e;
  exception when invalid_text_representation then
    raise exception 'Formato della formazione non valido.';
  end;
  v_count := coalesce(array_length(v_ids, 1), 0);
  if array_position(v_ids, null) is not null then
    raise exception 'Formato della formazione non valido.';
  end if;
  select count(distinct x) into v_distinct from unnest(v_ids) as x;
  if v_count <> v_distinct then
    raise exception 'Un membro compare più volte nella formazione.';
  end if;

  -- Every member belongs to the president's team; goalkeepers only through p_keeper_id.
  select count(*) into v_valid
  from unnest(v_ids) as l(player_id)
  join public.players p on p.id = l.player_id
  where p.team_id = v_team
    and not public.sl_is_goalkeeper(p.position);
  if v_valid <> v_count then
    raise exception 'La formazione contiene membri che non appartengono alla tua squadra o portieri fuori dal campo Portiere.';
  end if;

  if p_keeper_id is not null then
    if not exists (
      select 1 from public.players p
      where p.id = p_keeper_id and p.team_id = v_team
        and public.sl_is_goalkeeper(p.position) and not public.sl_is_staff(p.position)
    ) then
      raise exception 'Il portiere interno deve essere un portiere tesserato della tua squadra.';
    end if;
    v_ids := array_append(v_ids, p_keeper_id);
    v_starters := array_append(v_starters, true);
  end if;

  select count(*) into v_field
  from unnest(v_ids) as l(player_id)
  join public.players p on p.id = l.player_id
  where not public.sl_is_staff(p.position);
  if v_field = 0 and v_wildcard = '' then
    raise exception 'Seleziona almeno un giocatore.';
  end if;

  if v_wildcard <> '' then
    if char_length(v_wildcard) > 80 or v_wildcard !~ '^\S{2,}( \S+)*( \S{2,})$' then
      raise exception 'Indica nome e cognome della Wildcard.';
    end if;
  end if;

  delete from public.match_lineups
  where match_id = p_match_id and team_id = v_team and not (player_id = any (v_ids));

  insert into public.match_lineups (match_id, team_id, player_id, starter, shirt_number)
  -- STAFF members are listed apart from starters and bench.
  select p_match_id, v_team, l.player_id,
         case when public.sl_is_staff(p.position) then false else l.starter end,
         p.shirt_number
  from unnest(v_ids, v_starters) as l(player_id, starter)
  join public.players p on p.id = l.player_id
  on conflict (match_id, player_id) do update
    set team_id = excluded.team_id,
        starter = excluded.starter,
        shirt_number = excluded.shirt_number;

  if v_wildcard = '' then
    delete from public.match_wildcards where match_id = p_match_id and team_id = v_team;
  else
    insert into public.match_wildcards (match_id, team_id, full_name, starter)
    values (p_match_id, v_team, v_wildcard, coalesce(p_wildcard_starter, true))
    on conflict (match_id, team_id) do update
      set full_name = excluded.full_name,
          starter = excluded.starter;
  end if;

  insert into public.match_lineup_submissions (match_id, team_id, submitted_by, submitted_at)
  values (p_match_id, v_team, auth.uid(), now())
  on conflict (match_id, team_id) do update
    set submitted_by = excluded.submitted_by,
        submitted_at = excluded.submitted_at;

  return jsonb_build_object(
    'members', coalesce(array_length(v_ids, 1), 0),
    'wildcard', nullif(v_wildcard, ''),
    'submitted_at', now()
  );
end;
$$;

revoke all on function public.president_save_lineup(uuid, jsonb, uuid, text, boolean) from public, anon;
grant execute on function public.president_save_lineup(uuid, jsonb, uuid, text, boolean) to authenticated;

notify pgrst, 'reload schema';
