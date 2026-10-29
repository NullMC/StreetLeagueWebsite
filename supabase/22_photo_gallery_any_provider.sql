-- Street League: allow external Photo Gallery URLs from any sharing service.
-- Run once in Supabase SQL Editor if migration 20 was already applied.
-- Safe and repeatable: no existing photo gallery URLs or match records are modified.

alter table public.matches
  drop constraint if exists matches_photo_drive_url_valid;

notify pgrst, 'reload schema';
