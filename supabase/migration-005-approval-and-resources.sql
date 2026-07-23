-- ============================================================
-- Migration 005 — signup approval + department resources
-- Run once in the Hillcrest Hub project SQL Editor (ref qfsnwswiorjjqmzrbhea).
-- Idempotent.
-- ============================================================

-- ── Signup approval ──────────────────────────────────────
alter table profiles add column if not exists approved boolean not null default false;
-- Approve everyone who already exists so no one is locked out.
update profiles set approved = true where approved = false;

-- Extend the profile lock: only admins may change department OR approved.
create or replace function lock_department()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_role_of() <> 'admin' then
    if new.department is distinct from old.department then
      raise exception 'Only an admin can change a department';
    end if;
    if new.approved is distinct from old.approved then
      raise exception 'Only an admin can approve accounts';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists profiles_dept_lock on profiles;
create trigger profiles_dept_lock before update on profiles
  for each row execute function lock_department();

-- ── Department resources & tutorials ─────────────────────
create table if not exists resources (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  url         text,
  kind        text not null default 'link'
              check (kind in ('link','file','video','doc','note')),
  department  text,          -- null = visible to everyone
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table resources enable row level security;

-- Visible if it's for everyone, you're admin, or it matches your department.
drop policy if exists "read resources" on resources;
create policy "read resources" on resources for select using (
  department is null
  or current_role_of() = 'admin'
  or department = (select department from profiles where id = auth.uid())
);
-- Team Leads and up can add/edit/remove resources.
drop policy if exists "manage resources" on resources;
create policy "manage resources" on resources for all
  using (current_role_of() in ('admin','pastor','lead'))
  with check (current_role_of() in ('admin','pastor','lead'));

do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'resources') then
    alter publication supabase_realtime add table resources;
  end if;
end $$;
