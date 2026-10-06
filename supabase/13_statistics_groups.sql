-- Statistics groups for aggregating player statistics across multiple competitions.
alter table public.competitions
  add column if not exists statistics_group text;

create index if not exists idx_competitions_statistics_group
  on public.competitions (statistics_group);

notify pgrst, 'reload schema';
