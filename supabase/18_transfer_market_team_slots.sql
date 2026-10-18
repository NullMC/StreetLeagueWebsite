-- Upgrade existing transfer-market installations to one set of six slots per team.
-- If the old per-competition setup duplicated a team's slot, retain the most recently created entry.
begin;

alter table public.transfer_market_entries
  drop constraint if exists transfer_market_team_membership_fkey;
alter table public.transfer_market_entries
  drop constraint if exists transfer_market_one_entry_per_slot;

drop index if exists public.idx_transfer_market_competition_team;

with ranked_entries as (
  select
    id,
    row_number() over (
      partition by team_id, slot_number
      order by created_at desc nulls last, id desc
    ) as position
  from public.transfer_market_entries
)
delete from public.transfer_market_entries as entries
using ranked_entries
where entries.id = ranked_entries.id
  and ranked_entries.position > 1;

alter table public.transfer_market_entries
  drop column if exists competition_id;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.transfer_market_entries'::regclass
      and contype = 'f'
      and confrelid = 'public.teams'::regclass
  ) then
    alter table public.transfer_market_entries
      add constraint transfer_market_team_id_fkey
      foreign key (team_id) references public.teams(id) on delete cascade;
  end if;
end
$$;

create unique index if not exists transfer_market_one_entry_per_team_slot_idx
  on public.transfer_market_entries(team_id, slot_number);

drop index if exists public.idx_transfer_market_team_slot;
create index if not exists idx_transfer_market_team_slot
  on public.transfer_market_entries(team_id, slot_number);

commit;
