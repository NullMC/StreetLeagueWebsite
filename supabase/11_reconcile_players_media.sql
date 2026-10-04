-- Reconcile player media columns on already-provisioned Supabase projects.
-- The admin/player UI expects both a profile image and a background-less image.
alter table public.players
  add column if not exists profile_image_url text,
  add column if not exists bg_less_image_url text;

-- Force PostgREST to refresh its schema cache immediately after the DDL.
notify pgrst, 'reload schema';
