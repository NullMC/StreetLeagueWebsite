-- Street League
-- Migration 12: teams can participate in one or more competitions.
--
-- The former teams.competition_id relationship was 1:N.
-- This migration introduces the canonical N:N relation:
--   teams <-> competitions through competition_teams.
--
-- Existing team/competition assignments are preserved automatically.

create table if not exists public.competition_teams (
  competition_id uuid not null references public.competitions(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (competition_id, team_id)
);

create index if not exists idx_competition_teams_team
  on public.competition_teams(team_id);

create index if not exists idx_competition_teams_competition
  on public.competition_teams(competition_id);

-- Preserve every existing teams.competition_id assignment before removing
-- the legacy column.
insert into public.competition_teams (competition_id, team_id)
select distinct t.competition_id, t.id
from public.teams t
where t.competition_id is not null
on conflict (competition_id, team_id) do nothing;

alter table public.competition_teams enable row level security;

drop policy if exists "public read competition teams" on public.competition_teams;
create policy "public read competition teams"
  on public.competition_teams
  for select
  using (true);

drop policy if exists "admin manage competition teams" on public.competition_teams;
create policy "admin manage competition teams"
  on public.competition_teams
  for all
  using (public.is_staff('admin'))
  with check (public.is_staff('admin'));

-- Atomic replacement of a team's competition memberships.
create or replace function public.set_team_competitions(
  p_team_id uuid,
  p_competition_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  if not public.is_staff('admin') then
    raise exception 'Non hai i permessi per gestire le competizioni della squadra.';
  end if;

  if not exists (
    select 1
    from public.teams
    where id = p_team_id
  ) then
    raise exception 'Squadra non trovata.';
  end if;

  v_ids := array(
    select distinct x
    from unnest(coalesce(p_competition_ids, array[]::uuid[])) as items(x)
    where x is not null
  );

  if coalesce(cardinality(v_ids), 0) = 0 then
    raise exception 'Ogni squadra deve appartenere ad almeno una competizione.';
  end if;

  if exists (
    select 1
    from unnest(v_ids) as items(x)
    left join public.competitions c on c.id = items.x
    where c.id is null
  ) then
    raise exception 'Una o più competizioni selezionate non esistono.';
  end if;

  delete from public.competition_teams
  where team_id = p_team_id;

  insert into public.competition_teams (competition_id, team_id)
  select x, p_team_id
  from unnest(v_ids) as items(x);
end;
$$;

revoke all on function public.set_team_competitions(uuid, uuid[]) from public, anon;
grant execute on function public.set_team_competitions(uuid, uuid[]) to authenticated;

-- Replace the old integrity function before dropping teams.competition_id.
create or replace function public.validate_match_competition_teams()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.competition_teams ct
    where ct.competition_id = new.competition_id
      and ct.team_id = new.home_team_id
  ) then
    raise exception
      'La squadra di casa non appartiene alla competizione della partita.';
  end if;

  if not exists (
    select 1
    from public.competition_teams ct
    where ct.competition_id = new.competition_id
      and ct.team_id = new.away_team_id
  ) then
    raise exception
      'La squadra ospite non appartiene alla competizione della partita.';
  end if;

  if new.home_team_id = new.away_team_id then
    raise exception 'Le squadre devono essere diverse.';
  end if;

  return new;
end;
$$;

-- The legacy FK/unique constraint and column are no longer part of the model.
alter table public.teams
  drop constraint if exists teams_competition_id_fkey,
  drop constraint if exists teams_competition_id_slug_key;

drop index if exists public.idx_teams_competition;

alter table public.teams
  drop column if exists competition_id;
