-- Ensure player media columns exist on already-provisioned Supabase projects.
alter table public.players
  add column if not exists profile_image_url text,
  add column if not exists bg_less_image_url text;
