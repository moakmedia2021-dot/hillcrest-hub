-- ============================================================
-- Migration 016 — make people changes live
--
-- profiles and goals were never added to the realtime publication, so
-- role changes, staff toggles, approvals, removals, renames and new members
-- didn't reach open browsers — you had to reload to see them.
--
-- Run once in the SQL Editor. Idempotent.
-- ============================================================

do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'profiles') then
    alter publication supabase_realtime add table profiles;
  end if;

  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'goals') then
    alter publication supabase_realtime add table goals;
  end if;
end $$;

-- What's live now (should list every table the app watches):
-- select tablename from pg_publication_tables
--  where pubname = 'supabase_realtime' order by tablename;
