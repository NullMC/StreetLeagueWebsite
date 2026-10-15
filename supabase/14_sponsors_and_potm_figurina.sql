-- Unified sponsor presentation and POTM graphic card.
-- Existing sponsor rows are preserved while old tier values are normalized for compatibility.
alter table public.partners add column if not exists description text;
alter table public.partners alter column tier set default 'gold';
update public.partners set tier = 'gold' where tier <> 'gold';
alter table public.player_of_month add column if not exists card_image_url text;
