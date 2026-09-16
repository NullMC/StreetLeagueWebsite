-- Street League: Player of the Month
create table if not exists public.player_of_month (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  month_label text not null,
  note text,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (month_label)
);

alter table public.player_of_month enable row level security;

drop policy if exists "public player of month read" on public.player_of_month;
drop policy if exists "admin player of month insert" on public.player_of_month;
drop policy if exists "admin player of month update" on public.player_of_month;
drop policy if exists "admin player of month delete" on public.player_of_month;

create policy "public player of month read"
  on public.player_of_month for select
  using (true);

create policy "admin player of month insert"
  on public.player_of_month for insert to authenticated
  with check (public.is_staff('admin'));

create policy "admin player of month update"
  on public.player_of_month for update to authenticated
  using (public.is_staff('admin'))
  with check (public.is_staff('admin'));

create policy "admin player of month delete"
  on public.player_of_month for delete to authenticated
  using (public.is_staff('admin'));

create index if not exists idx_player_of_month_published_at
  on public.player_of_month(published_at desc);
