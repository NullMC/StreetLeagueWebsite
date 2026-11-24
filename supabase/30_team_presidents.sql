-- Street League: area presidenti (formazioni inviate dalle squadre) e Wildcard titolare/riserva.
-- Run AFTER migration 29. Existing lineups, Wildcards, events, MVPs and ratings stay untouched.
--
-- 1. One president account per team (team_presidents). A president is a normal Supabase Auth
--    user whose profile keeps the role 'viewer': is_staff() stays false, so every back-office
--    policy keeps refusing them. Accounts are created by the super admin through the
--    Edge Function "president-admin" (service role), never by the president.
-- 2. A president writes nothing directly: the only write path is president_save_lineup(),
--    a SECURITY DEFINER function that checks on the server, at every call, that
--      - the caller is an active president and the match belongs to their team;
--      - the competition is active and the team is registered to it;
--      - the match is still scheduled and its kickoff has not been reached yet;
--      - every member belongs to the team; the internal goalkeeper is a registered goalkeeper.
--    Then it replaces that team's lineup and Wildcard for the match in one transaction.
-- 3. The Wildcard has no role any more: it is a starter or a reserve. The old position column
--    stays (nullable) only for Wildcards saved before this migration, so a past Wildcard
--    goalkeeper keeps its end-of-match rating.
-- 4. match_lineup_submissions records who sent each lineup and when (shown in the back office).

-- ---------------------------------------------------------------------------
-- New Auth users always start as 'viewer'
-- ---------------------------------------------------------------------------
-- The live trigger read the role from raw_user_meta_data, which the user controls at sign-up:
-- once the type error it raised was fixed, anyone could have signed up as super_admin.
-- The role now never comes from the client; staff roles are granted only by a super admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, username, full_name, role, is_active, created_at, updated_at)
  values (
    new.id,
    nullif(lower(btrim(coalesce(new.email, ''))), ''),
    nullif(lower(btrim(coalesce(new.raw_user_meta_data->>'username', ''))), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    'viewer'::public.app_role,
    true,
    now(),
    now()
  )
  on conflict (id) do update set
    email = coalesce(excluded.email, public.profiles.email),
    username = coalesce(excluded.username, public.profiles.username),
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Wildcard: titolare o riserva
-- ---------------------------------------------------------------------------
alter table public.match_wildcards
  add column if not exists starter boolean not null default true;

alter table public.match_wildcards
  alter column position drop not null;

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
  new.full_name := regexp_replace(btrim(new.full_name), '\s+', ' ', 'g');
  -- Only Wildcards saved as goalkeeper before migration 30 can keep a rating.
  if new.position is distinct from 'Portiere' then
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

-- ---------------------------------------------------------------------------
-- Presidents
-- ---------------------------------------------------------------------------
create table if not exists public.team_presidents (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  team_id uuid not null unique references public.teams(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.team_presidents enable row level security;

drop policy if exists "president reads own team link" on public.team_presidents;
create policy "president reads own team link"
  on public.team_presidents for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists "super admin reads team presidents" on public.team_presidents;
create policy "super admin reads team presidents"
  on public.team_presidents for select to authenticated
  using (public.is_super_admin());

-- Links are created and removed only by the Edge Function (service role).
revoke all on public.team_presidents from anon, authenticated;
grant select on public.team_presidents to authenticated;
grant all on public.team_presidents to service_role;

-- Team of the signed-in president, or null (not a president, or account disabled).
create or replace function public.current_president_team()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tp.team_id
  from public.team_presidents tp
  join public.profiles p on p.id = tp.profile_id
  where tp.profile_id = auth.uid()
    and p.is_active = true
    and p.role = 'viewer';
$$;

revoke all on function public.current_president_team() from public, anon;
grant execute on function public.current_president_team() to authenticated;

-- Used by the Edge Function when a password is regenerated or an account disabled:
-- every open session of that user is closed.
create or replace function public.revoke_user_sessions(p_user_id uuid)
returns void
language sql
security definer
set search_path = public, auth
as $$
  delete from auth.sessions where user_id = p_user_id;
$$;

revoke all on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Who sent each lineup
-- ---------------------------------------------------------------------------
create table if not exists public.match_lineup_submissions (
  match_id uuid not null references public.matches(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  submitted_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz not null default now(),
  primary key (match_id, team_id)
);

alter table public.match_lineup_submissions enable row level security;

drop policy if exists "staff and own president read submissions" on public.match_lineup_submissions;
create policy "staff and own president read submissions"
  on public.match_lineup_submissions for select to authenticated
  using (public.is_staff('operator') or team_id = public.current_president_team());

revoke all on public.match_lineup_submissions from anon, authenticated;
grant select on public.match_lineup_submissions to authenticated;
grant all on public.match_lineup_submissions to service_role;

-- ---------------------------------------------------------------------------
-- The only write path for presidents
-- ---------------------------------------------------------------------------
create or replace function public.sl_is_goalkeeper(p_position text)
returns boolean
language sql
immutable
as $$
  select lower(btrim(coalesce(p_position, ''))) like '%portier%'
      or lower(btrim(coalesce(p_position, ''))) like '%goalkeeper%'
      or lower(btrim(coalesce(p_position, ''))) like '%goalie%'
      or lower(btrim(coalesce(p_position, ''))) in ('gk', 'por');
$$;

create or replace function public.sl_is_staff(p_position text)
returns boolean
language sql
immutable
as $$
  select upper(btrim(coalesce(p_position, ''))) = 'STAFF';
$$;

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
  if now() >= v_match.kickoff_at then
    raise exception 'Tempo scaduto: la formazione si può registrare solo fino al calcio d''inizio (%).',
      to_char(v_match.kickoff_at at time zone 'Europe/Rome', 'DD/MM/YYYY HH24:MI');
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
