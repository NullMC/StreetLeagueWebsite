-- Remove team metadata that is no longer part of the Street League team model.
-- The public/admin UI now uses only: competition, name, slug, logo and accent color.
alter table public.teams
  drop column if exists short_name,
  drop column if exists city;
