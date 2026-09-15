alter table public.active_collaborations
  add column if not exists cta_url text;
