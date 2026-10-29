-- Street League: custom ordering for featured editorial articles.
-- Apply ONCE in the live Supabase SQL Editor after existing migrations.
-- Existing articles retain their current newest-first order on first run.
-- Re-running does not overwrite manually configured positions.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'social_contents'
      and column_name = 'sort_order'
  ) then
    alter table public.social_contents
      add column sort_order integer not null default 0;

    -- Preserve current homepage order: published_at DESC, created_at DESC.
    with positions as (
      select id,
        (row_number() over (
          order by published_at desc nulls last, created_at desc, id
        ) - 1)::integer as position
      from public.social_contents
    )
    update public.social_contents article
    set sort_order = positions.position
    from positions
    where article.id = positions.id;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'social_contents_sort_order_nonnegative'
      and conrelid = 'public.social_contents'::regclass
  ) then
    alter table public.social_contents
      add constraint social_contents_sort_order_nonnegative
      check (sort_order >= 0);
  end if;
end
$$;

create index if not exists idx_social_contents_sort_order
  on public.social_contents(sort_order asc, published_at desc nulls last, created_at desc);

notify pgrst, 'reload schema';
