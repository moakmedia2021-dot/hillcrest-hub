-- ============================================================
-- Migration 007 — MULTI-TENANCY (many churches on one platform)
--
-- Every church becomes an "organization". All data is scoped to it and
-- isolated at the database level, so one church can never see another's
-- people, chats, events, or files.
--
-- Run once in the SQL Editor. Idempotent.
-- IMPORTANT: this backfills all existing data into a first organization
-- so nothing you already have is lost.
-- ============================================================

-- ── Organizations ────────────────────────────────────────
create table if not exists organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique,
  invite_code text unique not null,
  brand_color text default '#12a6db',
  logo_url    text,
  created_at  timestamptz not null default now()
);
alter table organizations enable row level security;

-- Short, readable, unambiguous invite codes (no O/0/I/1 confusion).
create or replace function gen_invite_code()
returns text language sql volatile as $$
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
           floor(random() * 32 + 1)::int, 1), '')
  from generate_series(1, 7)
$$;

-- ── org_id on the top-level tables ───────────────────────
-- Child tables (messages, channel_members, event_tasks, event_rsvps,
-- availability, message_deletions) inherit scope through their parent.
alter table profiles  add column if not exists org_id uuid references organizations(id) on delete cascade;
alter table channels  add column if not exists org_id uuid references organizations(id) on delete cascade;
alter table tasks     add column if not exists org_id uuid references organizations(id) on delete cascade;
alter table events    add column if not exists org_id uuid references organizations(id) on delete cascade;
alter table resources add column if not exists org_id uuid references organizations(id) on delete cascade;
alter table kudos     add column if not exists org_id uuid references organizations(id) on delete cascade;

-- ── Backfill: everything that exists today becomes one church ──
do $$
declare first_org uuid;
begin
  if not exists (select 1 from organizations) then
    insert into organizations (name, slug, invite_code)
      values ('Hillcrest Assembly of God', 'hillcrest', gen_invite_code())
      returning id into first_org;
  else
    select id into first_org from organizations order by created_at limit 1;
  end if;

  update profiles  set org_id = first_org where org_id is null;
  update channels  set org_id = first_org where org_id is null;
  update tasks     set org_id = first_org where org_id is null;
  update events    set org_id = first_org where org_id is null;
  update resources set org_id = first_org where org_id is null;
  update kudos     set org_id = first_org where org_id is null;
end $$;

-- ── The org of the person making the request ─────────────
create or replace function current_org()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from profiles where id = auth.uid()
$$;

-- Default new rows to the caller's org so inserts can't leak across churches.
alter table channels  alter column org_id set default current_org();
alter table tasks     alter column org_id set default current_org();
alter table events    alter column org_id set default current_org();
alter table resources alter column org_id set default current_org();
alter table kudos     alter column org_id set default current_org();

-- ── Organizations policies ───────────────────────────────
drop policy if exists "read own org" on organizations;
create policy "read own org" on organizations for select
  using (id = current_org());

drop policy if exists "admin updates own org" on organizations;
create policy "admin updates own org" on organizations for update
  using (id = current_org() and current_role_of() = 'admin')
  with check (id = current_org() and current_role_of() = 'admin');

-- ── Re-scope every policy to the caller's church ─────────

-- Profiles: only see people in your church.
drop policy if exists "read profiles" on profiles;
create policy "read profiles" on profiles for select
  using (org_id = current_org() or id = auth.uid());

drop policy if exists "admin write profiles" on profiles;
create policy "admin write profiles" on profiles for all
  using (current_role_of() = 'admin' and org_id = current_org())
  with check (current_role_of() = 'admin' and org_id = current_org());

-- Channels: everyone / admin / explicit member / same department — all within the church.
create or replace function is_channel_visible(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from channels c
    where c.id = cid
      and c.org_id = current_org()
      and (
        c.everyone = true
        or current_role_of() = 'admin'
        or exists (select 1 from channel_members cm
                   where cm.channel_id = cid and cm.member_id = auth.uid())
        or (c.department is not null
            and c.department = (select department from profiles where id = auth.uid()))
      )
  )
$$;

drop policy if exists "manage channels" on channels;
create policy "manage channels" on channels for all
  using (org_id = current_org() and current_role_of() in ('admin','pastor'))
  with check (org_id = current_org() and current_role_of() in ('admin','pastor'));

-- Tasks, events, resources, kudos: scoped to the church.
drop policy if exists "read tasks" on tasks;
create policy "read tasks" on tasks for select using (org_id = current_org());
drop policy if exists "write tasks" on tasks;
create policy "write tasks" on tasks for all
  using (org_id = current_org() and current_role_of() in ('admin','pastor','lead'))
  with check (org_id = current_org() and current_role_of() in ('admin','pastor','lead'));

drop policy if exists "read events" on events;
create policy "read events" on events for select using (org_id = current_org());
drop policy if exists "write events" on events;
create policy "write events" on events for all
  using (org_id = current_org() and current_role_of() in ('admin','pastor','lead'))
  with check (org_id = current_org() and current_role_of() in ('admin','pastor','lead'));

drop policy if exists "read resources" on resources;
create policy "read resources" on resources for select using (
  org_id = current_org()
  and (department is null
       or current_role_of() = 'admin'
       or department = (select department from profiles where id = auth.uid()))
);
drop policy if exists "manage resources" on resources;
create policy "manage resources" on resources for all
  using (org_id = current_org() and current_role_of() in ('admin','pastor','lead'))
  with check (org_id = current_org() and current_role_of() in ('admin','pastor','lead'));

drop policy if exists "read kudos" on kudos;
create policy "read kudos" on kudos for select using (org_id = current_org());
drop policy if exists "give kudos" on kudos;
create policy "give kudos" on kudos for insert
  with check (from_id = auth.uid() and org_id = current_org());

-- Child tables: scope through their parent row.
drop policy if exists "read availability" on availability;
create policy "read availability" on availability for select using (
  exists (select 1 from profiles p where p.id = member_id and p.org_id = current_org())
);

drop policy if exists "read rsvps" on event_rsvps;
create policy "read rsvps" on event_rsvps for select using (
  exists (select 1 from events e where e.id = event_id and e.org_id = current_org())
);

drop policy if exists "read event_tasks" on event_tasks;
create policy "read event_tasks" on event_tasks for select using (
  exists (select 1 from events e where e.id = event_id and e.org_id = current_org())
);
drop policy if exists "write event_tasks" on event_tasks;
create policy "write event_tasks" on event_tasks for all
  using (exists (select 1 from events e where e.id = event_id and e.org_id = current_org())
         and current_role_of() in ('admin','pastor','lead'))
  with check (exists (select 1 from events e where e.id = event_id and e.org_id = current_org())
         and current_role_of() in ('admin','pastor','lead'));

-- ── Joining / creating a church ──────────────────────────
-- A brand-new account has no org. It either starts a church (and becomes its
-- admin) or joins one with an invite code (and waits for approval).

create or replace function create_organization(org_name text)
returns json language plpgsql security definer set search_path = public as $$
declare new_org organizations;
begin
  if (select org_id from profiles where id = auth.uid()) is not null then
    raise exception 'You already belong to a church';
  end if;
  insert into organizations (name, invite_code)
    values (trim(org_name), gen_invite_code())
    returning * into new_org;

  update profiles
     set org_id = new_org.id, role = 'admin', approved = true
   where id = auth.uid();

  -- Starter chat channels so the church has somewhere to talk on day one.
  insert into channels (name, kind, description, everyone, org_id) values
    ('Announcements', 'announcement', 'Church-wide announcements from leadership.', true, new_org.id),
    ('Staff', 'team', 'Staff and leadership.', true, new_org.id);

  return json_build_object('id', new_org.id, 'name', new_org.name,
                           'invite_code', new_org.invite_code);
end $$;
grant execute on function create_organization(text) to authenticated;

create or replace function join_organization(code text)
returns json language plpgsql security definer set search_path = public as $$
declare target organizations;
begin
  if (select org_id from profiles where id = auth.uid()) is not null then
    raise exception 'You already belong to a church';
  end if;
  select * into target from organizations
   where upper(invite_code) = upper(trim(code));
  if target.id is null then
    raise exception 'That invite code does not match any church';
  end if;

  -- Joins land as an unapproved volunteer; an admin lets them in.
  update profiles
     set org_id = target.id, role = 'volunteer', approved = false
   where id = auth.uid();

  return json_build_object('id', target.id, 'name', target.name);
end $$;
grant execute on function join_organization(text) to authenticated;

-- Admins can roll their invite code if it gets shared too widely.
create or replace function regenerate_invite_code()
returns text language plpgsql security definer set search_path = public as $$
declare fresh text;
begin
  if current_role_of() <> 'admin' then
    raise exception 'Only an admin can change the invite code';
  end if;
  fresh := gen_invite_code();
  update organizations set invite_code = fresh where id = current_org();
  return fresh;
end $$;
grant execute on function regenerate_invite_code() to authenticated;

-- ── Keep people from moving themselves between churches ──
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
  -- Nobody may move an existing profile to a different church.
  if old.org_id is not null and new.org_id is distinct from old.org_id then
    raise exception 'A member cannot be moved between churches';
  end if;
  return new;
end $$;
drop trigger if exists profiles_dept_lock on profiles;
create trigger profiles_dept_lock before update on profiles
  for each row execute function lock_department();

-- ── Realtime ─────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and tablename='organizations') then
    alter publication supabase_realtime add table organizations;
  end if;
end $$;

-- ── Your church's invite code (share this with your team) ──
-- select name, invite_code from organizations;
