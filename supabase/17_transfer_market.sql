-- Calcio mercato: six unique slots per team, shared across all competitions.
create table if not exists public.transfer_market_entries (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  slot_number smallint not null check (slot_number between 1 and 6),
  player_id uuid references public.players(id) on delete cascade,
  external_first_name text,
  external_last_name text,
  external_position text,
  external_shirt_number integer check (external_shirt_number is null or external_shirt_number >= 0),
  external_photo_url text,
  notes text,
  created_at timestamptz not null default now(),
  constraint transfer_market_one_entry_per_slot unique (team_id, slot_number),
  constraint transfer_market_player_source check (
    player_id is not null or (
      nullif(trim(external_first_name), '') is not null
      and nullif(trim(external_last_name), '') is not null
    )
  )
);

create index if not exists idx_transfer_market_team_slot
  on public.transfer_market_entries(team_id, slot_number);

alter table public.transfer_market_entries enable row level security;

drop policy if exists "public read transfer market entries" on public.transfer_market_entries;
create policy "public read transfer market entries"
  on public.transfer_market_entries for select using (true);

drop policy if exists "admin manage transfer market entries" on public.transfer_market_entries;
create policy "admin manage transfer market entries"
  on public.transfer_market_entries for all
  using (public.is_staff('admin'))
  with check (public.is_staff('admin'));

grant select on public.transfer_market_entries to anon, authenticated;
grant insert, update, delete on public.transfer_market_entries to authenticated;
