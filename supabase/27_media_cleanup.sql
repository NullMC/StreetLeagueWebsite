-- Street League: pulizia dei media inutilizzati nel bucket street-league-media.
-- Run AFTER migration 26. No data is changed: it only adds read-only helpers.
--
-- A file is "in use" when any text/json column of any public table contains its
-- path (logos, player photos, partner images, social thumbnails, images inside
-- article bodies...). The columns are discovered at run time, so new media
-- columns are covered automatically.
--
-- The back office uses these helpers to delete a replaced file only when no
-- other record still points to it, and to list leftover files for a manual cleanup.
-- Files themselves are always deleted through the Storage API (never via SQL).

create or replace function public.media_references()
returns setof text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and c.data_type in ('text', 'character varying', 'json', 'jsonb')
  loop
    return query execute format(
      'select (regexp_matches(%1$I::text, ''street-league-media/([^"''''\s)?<>&]+)'', ''g''))[1]
         from public.%2$I
        where position(''street-league-media/'' in %1$I::text) > 0',
      r.column_name, r.table_name);
  end loop;
end;
$$;

-- How many references point to one object path (e.g. 'logos/<uuid>.webp').
create or replace function public.media_reference_count(p_path text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.media_references() as ref
  where ref = btrim(p_path);
$$;

-- Files no record points to, older than p_min_age (fresh uploads may still be
-- waiting for their form to be saved).
create or replace function public.list_unused_media(p_min_age interval default interval '1 day')
returns table (name text, size bigint, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, storage
as $$
begin
  if not public.is_staff('admin') then
    raise exception 'Operazione riservata agli amministratori';
  end if;
  return query
    select o.name, coalesce((o.metadata->>'size')::bigint, 0), o.created_at
    from storage.objects o
    where o.bucket_id = 'street-league-media'
      and o.name not like '%.emptyFolderPlaceholder'
      and o.created_at < now() - p_min_age
      and not exists (select 1 from public.media_references() as ref where ref = o.name)
    order by o.created_at;
end;
$$;

revoke all on function public.media_references() from public, anon;
revoke all on function public.media_reference_count(text) from public, anon;
revoke all on function public.list_unused_media(interval) from public, anon;
grant execute on function public.media_references() to authenticated;
grant execute on function public.media_reference_count(text) to authenticated;
grant execute on function public.list_unused_media(interval) to authenticated;

notify pgrst, 'reload schema';
