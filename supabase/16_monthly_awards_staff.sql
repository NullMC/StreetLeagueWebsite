-- Allow a POTM and a Staff of the Month assignment for the same month.
-- Existing rows are treated as POTM by the default value.
alter table public.player_of_month
  add column if not exists award_type text not null default 'player';

alter table public.player_of_month
  drop constraint if exists player_of_month_month_label_key;

alter table public.player_of_month
  drop constraint if exists player_of_month_award_type_check;

alter table public.player_of_month
  add constraint player_of_month_award_type_check
  check (award_type in ('player', 'staff'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'player_of_month_month_label_award_type_key'
      and conrelid = 'public.player_of_month'::regclass
  ) then
    alter table public.player_of_month
      add constraint player_of_month_month_label_award_type_key
      unique (month_label, award_type);
  end if;
end $$;

create index if not exists idx_player_of_month_type_published_at
  on public.player_of_month(award_type, published_at desc);
