-- Active collaborations now support ad-style announcements with optional artwork.
alter table public.active_collaborations
  add column if not exists title text;

alter table public.active_collaborations
  add column if not exists description text;

update public.active_collaborations
set title = coalesce(nullif(title, ''), 'Collaborazione attiva'),
    description = coalesce(description, '')
where title is null or description is null;

alter table public.active_collaborations
  alter column title set not null,
  alter column title set default 'Collaborazione attiva',
  alter column description set not null,
  alter column description set default '';

alter table public.active_collaborations
  alter column flyer_url drop not null;
