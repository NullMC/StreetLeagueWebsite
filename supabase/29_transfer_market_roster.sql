-- Street League: un giocatore registrato nel calciomercato entra nella lista giocatori della squadra.
-- Run AFTER migration 28.
--
-- Ogni record del calciomercato (inserito o modificato) viene collegato a un giocatore della
-- squadra dello slot:
-- - giocatore esterno (nome e cognome scritti a mano): se la squadra ha già un giocatore con lo
--   stesso nome e cognome (maiuscole e spazi ignorati) viene collegato quello, completando solo i
--   dati mancanti (numero, ruolo, foto); altrimenti il giocatore viene creato nella squadra.
--   I campi "esterni" del record vengono poi svuotati: i dati vivono nella scheda del giocatore.
-- - giocatore già registrato in un'altra squadra: viene spostato nella squadra dello slot
--   (le partite già giocate restano alla squadra di allora, salvata nelle formazioni).
-- In fondo, gli stessi passaggi vengono applicati ai record già inseriti, senza creare doppioni.

create or replace function public.sl_normalize_name(value text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(btrim(coalesce(value, '')), '\s+', ' ', 'g'));
$$;

create or replace function public.link_transfer_market_player()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
begin
  if new.player_id is null then
    if nullif(btrim(new.external_first_name), '') is null
       or nullif(btrim(new.external_last_name), '') is null then
      return new; -- the table check constraint reports the missing name
    end if;

    -- Same first and last name already in this team: reuse that player (no duplicates).
    select p.id into v_player_id
    from public.players p
    where p.team_id = new.team_id
      and public.sl_normalize_name(p.first_name) = public.sl_normalize_name(new.external_first_name)
      and public.sl_normalize_name(p.last_name) = public.sl_normalize_name(new.external_last_name)
    order by p.created_at
    limit 1;

    if v_player_id is not null then
      update public.players p
         set shirt_number = coalesce(p.shirt_number, new.external_shirt_number),
             position = coalesce(nullif(btrim(p.position), ''), nullif(btrim(new.external_position), '')),
             profile_image_url = coalesce(nullif(btrim(p.profile_image_url), ''), nullif(btrim(new.external_photo_url), ''))
       where p.id = v_player_id;
    else
      insert into public.players (team_id, first_name, last_name, shirt_number, position, profile_image_url)
      values (
        new.team_id,
        btrim(new.external_first_name),
        btrim(new.external_last_name),
        new.external_shirt_number,
        nullif(btrim(new.external_position), ''),
        nullif(btrim(new.external_photo_url), '')
      )
      returning id into v_player_id;
    end if;

    new.player_id := v_player_id;
  else
    -- Registered player coming from another team: he joins the team of the slot.
    update public.players
       set team_id = new.team_id
     where id = new.player_id
       and team_id is distinct from new.team_id;
  end if;

  new.external_first_name := null;
  new.external_last_name := null;
  new.external_position := null;
  new.external_shirt_number := null;
  new.external_photo_url := null;
  return new;
end;
$$;

drop trigger if exists transfer_market_link_player on public.transfer_market_entries;
create trigger transfer_market_link_player
  before insert or update on public.transfer_market_entries
  for each row execute function public.link_transfer_market_player();

-- Existing records: run the same logic once (a no-op update fires the trigger).
update public.transfer_market_entries
   set team_id = team_id
 where player_id is null
    or exists (
      select 1 from public.players p
      where p.id = transfer_market_entries.player_id
        and p.team_id <> transfer_market_entries.team_id
    );

notify pgrst, 'reload schema';
