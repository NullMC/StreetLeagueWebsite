-- Remove team metadata that is no longer part of the Street League team model.
-- Competition membership is managed by competition_teams (one or more competitions).
alter table public.teams
  drop column if exists short_name,
  drop column if exists city;
