-- Add the sponsor activity/cover image used by the image-led MUI sponsor cards.
alter table public.partners
  add column if not exists activity_image_url text;

comment on column public.partners.activity_image_url
  is 'Optional URL of the activity/cover image shown on the public sponsor card';
