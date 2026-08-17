-- ============================================================
-- Migration 011 — per-church departments + first-run setup
--
-- Two things:
--   1. Departments become real, per-church rows instead of one hardcoded list
--      every church shares. A church with three ministries should only ever
--      see its own three.
--   2. A setup flag so a brand-new church gets a wizard that builds its
--      ministries, department chats and starter resources — instead of
--      landing in an empty app.
--
-- Run once in the SQL Editor. Idempotent.
-- ============================================================

-- ── Departments ──────────────────────────────────────────
create table if not exists departments (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade
             default current_org(),
  name       text not null,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);
alter table departments enable row level security;

drop policy if exists "read departments" on departments;
create policy "read departments" on departments for select
  using (org_id = current_org());

drop policy if exists "manage departments" on departments;
create policy "manage departments" on departments for all
  using (org_id = current_org() and current_role_of() = 'admin')
  with check (org_id = current_org() and current_role_of() = 'admin');

-- ── Setup flag ───────────────────────────────────────────
alter table organizations
  add column if not exists setup_complete boolean not null default false;

-- ── Backfill: existing churches keep working ─────────────
-- Their departments come from whatever their people and channels already use,
-- and they're marked set up so no wizard appears for them.
do $$
declare o record;
begin
  for o in select id from organizations loop
    insert into departments (org_id, name)
      select distinct o.id, p.department
        from profiles p
       where p.org_id = o.id
         and coalesce(trim(p.department), '') <> ''
      on conflict (org_id, name) do nothing;

    insert into departments (org_id, name)
      select distinct o.id, c.department
        from channels c
       where c.org_id = o.id
         and coalesce(trim(c.department), '') <> ''
      on conflict (org_id, name) do nothing;
  end loop;

  update organizations set setup_complete = true where setup_complete = false;
end $$;

-- ── First-run setup ──────────────────────────────────────
-- Creates the church's ministries, a chat for each (auto-visible to everyone
-- in that department), a couple of starter resources, and marks setup done.
create or replace function complete_setup(dept_names text[])
returns json language plpgsql security definer set search_path = public as $$
declare
  d text;
  made int := 0;
  org uuid := current_org();
begin
  if current_role_of() <> 'admin' then
    raise exception 'Only a church admin can run setup';
  end if;
  if org is null then
    raise exception 'You do not belong to a church yet';
  end if;

  foreach d in array coalesce(dept_names, '{}')
  loop
    d := trim(d);
    continue when d = '';

    insert into departments (org_id, name) values (org, d)
      on conflict (org_id, name) do nothing;

    -- One chat per ministry, scoped to that department.
    if not exists (
      select 1 from channels c where c.org_id = org and c.department = d
    ) then
      insert into channels (name, kind, description, everyone, department, org_id)
        values (d, 'department', d || ' team chat.', false, d, org);
    end if;

    made := made + 1;
  end loop;

  -- A starting point for the resources library.
  if not exists (select 1 from resources r where r.org_id = org) then
    insert into resources (title, description, kind, department, org_id) values
      ('Volunteer Handbook',
       'Start here — what to expect serving on a team.', 'doc', null, org),
      ('New Volunteer Onboarding',
       'The steps every new volunteer walks through.', 'note', null, org);
  end if;

  update organizations set setup_complete = true where id = org;

  return json_build_object('departments', made);
end $$;
grant execute on function complete_setup(text[]) to authenticated;

-- Skipping setup still marks the church as set up.
create or replace function skip_setup()
returns void language plpgsql security definer set search_path = public as $$
begin
  if current_role_of() <> 'admin' then
    raise exception 'Only a church admin can run setup';
  end if;
  update organizations set setup_complete = true where id = current_org();
end $$;
grant execute on function skip_setup() to authenticated;

-- New churches start unconfigured so the wizard runs for them.
create or replace function create_organization(org_name text, plan_name text default 'starter')
returns json language plpgsql security definer set search_path = public as $$
declare new_org organizations;
begin
  if (select org_id from profiles where id = auth.uid()) is not null then
    raise exception 'You already belong to a church';
  end if;
  if coalesce(trim(org_name), '') = '' then
    raise exception 'Please enter your church name';
  end if;

  insert into organizations (name, invite_code, plan, status, trial_ends_at, setup_complete)
    values (trim(org_name), gen_invite_code(), coalesce(plan_name, 'starter'),
            'trialing', now() + interval '14 days', false)
    returning * into new_org;

  update profiles
     set org_id = new_org.id, role = 'admin', approved = true
   where id = auth.uid();

  insert into channels (name, kind, description, everyone, org_id) values
    ('Announcements', 'announcement', 'Church-wide announcements from leadership.', true, new_org.id),
    ('Staff', 'team', 'Staff and leadership.', true, new_org.id);

  return json_build_object('id', new_org.id, 'name', new_org.name,
                           'invite_code', new_org.invite_code,
                           'status', new_org.status);
end $$;
grant execute on function create_organization(text, text) to authenticated;

-- ── Realtime ─────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and tablename='departments') then
    alter publication supabase_realtime add table departments; end if;
end $$;
