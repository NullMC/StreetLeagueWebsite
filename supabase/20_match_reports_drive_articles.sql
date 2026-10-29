-- Street League: match photo folders, full editorial articles, and referee-report integrity.
-- Execute ONCE in the Supabase SQL Editor linked to the live platform.
-- Existing match_lineups, match_events and social_contents records remain intact.

alter table public.matches
  add column if not exists photo_drive_url text;

alter table public.social_contents
  add column if not exists article_body text not null default '',
  add column if not exists description text,
  add column if not exists image_url text;

-- Photo Gallery accepts share links from any provider (no provider-specific CHECK).

-- Allow old events to remain readable; validate new/edited reports on the server.
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
  select id, status, home_team_id, away_team_id into v_match
  from public.matches where id = new.match_id;
  if v_match.id is null or v_match.status::text <> 'finished' then
    raise exception 'Gli eventi possono essere registrati solo per partite terminate';
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
    raise exception 'Per questo evento seleziona un giocatore in formazione';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_street_match_report_event on public.match_events;
create trigger trg_validate_street_match_report_event
before insert or update on public.match_events
for each row execute function public.validate_street_match_report_event();

-- Keep newly inserted lineups consistent with the match and player team.
create or replace function public.validate_street_match_lineup()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_match record;
  v_team_id uuid;
begin
  select home_team_id, away_team_id into v_match
  from public.matches where id = new.match_id;
  select team_id into v_team_id from public.players where id = new.player_id;
  if new.team_id not in (v_match.home_team_id, v_match.away_team_id) or
     v_team_id is distinct from new.team_id then
    raise exception 'La formazione può includere solo giocatori della squadra in partita';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_street_match_lineup on public.match_lineups;
create trigger trg_validate_street_match_lineup
before insert or update on public.match_lineups
for each row execute function public.validate_street_match_lineup();

notify pgrst, 'reload schema';
