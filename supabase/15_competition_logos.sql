-- Give competition pictograms their own semantic column.
alter table public.competitions
  add column if not exists logo_url text;

-- Preserve logos already saved in the old hero/background image field.
update public.competitions
set logo_url = hero_image_url
where (logo_url is null or btrim(logo_url) = '')
  and hero_image_url is not null
  and btrim(hero_image_url) <> '';
