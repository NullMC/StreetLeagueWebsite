-- Street League: Top 7 del mese compilata a mano dal back office.
-- Run AFTER migration 27. Adds one table, no existing data is changed.
--
-- Prima la Top 7 veniva ricalcolata a ogni caricamento del sito e cambiava man mano
-- che le statistiche crescevano. Ora un amministratore la "compila" dalla sezione
-- POTM & Staff del mese: viene salvata una fotografia dei migliori giocatori in quel
-- momento e il sito mostra sempre l'ultima compilazione, finché non se ne fa un'altra.

create table if not exists public.monthly_top_seven (
  id uuid primary key default gen_random_uuid(),
  -- Primo giorno del mese a cui si riferisce la selezione.
  period_month date not null check (period_month = date_trunc('month', period_month)::date),
  -- Elenco dei 7 giocatori con le statistiche congelate al momento della compilazione:
  -- [{ "slot": "goalkeeper|defender|midfielder|attacker", "player_id", "team_id",
  --    "goals", "assists", "appearances", "keeper_average", "keeper_votes" }, ...]
  players jsonb not null check (jsonb_typeof(players) = 'array'),
  compiled_at timestamptz not null default now(),
  compiled_by uuid references auth.users(id) on delete set null default auth.uid()
);

create index if not exists monthly_top_seven_compiled_at_idx
  on public.monthly_top_seven (compiled_at desc);

alter table public.monthly_top_seven enable row level security;

drop policy if exists "public read monthly top seven" on public.monthly_top_seven;
create policy "public read monthly top seven"
  on public.monthly_top_seven for select using (true);

drop policy if exists "admin manage monthly top seven" on public.monthly_top_seven;
create policy "admin manage monthly top seven"
  on public.monthly_top_seven for all
  using (public.is_staff('admin'))
  with check (public.is_staff('admin'));

grant select on public.monthly_top_seven to anon, authenticated;
grant insert, update, delete on public.monthly_top_seven to authenticated;

notify pgrst, 'reload schema';
