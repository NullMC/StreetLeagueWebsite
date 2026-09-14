-- Street League: active collaborations / flyer carousel
create table if not exists public.active_collaborations (
  id uuid primary key default gen_random_uuid(),
  flyer_url text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

alter table public.active_collaborations enable row level security;

drop policy if exists "public active collaborations read" on public.active_collaborations;
drop policy if exists "staff active collaborations insert" on public.active_collaborations;
drop policy if exists "staff active collaborations update" on public.active_collaborations;
drop policy if exists "staff active collaborations delete" on public.active_collaborations;

create policy "public active collaborations read"
  on public.active_collaborations for select
  using (true);

create policy "staff active collaborations insert"
  on public.active_collaborations for insert to authenticated
  with check (public.is_staff('admin'));

create policy "staff active collaborations update"
  on public.active_collaborations for update to authenticated
  using (public.is_staff('admin'))
  with check (public.is_staff('admin'));

create policy "staff active collaborations delete"
  on public.active_collaborations for delete to authenticated
  using (public.is_staff('admin'));

create index if not exists active_collaborations_sort_idx
  on public.active_collaborations (sort_order, created_at);
