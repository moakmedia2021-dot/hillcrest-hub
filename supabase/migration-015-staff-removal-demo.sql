-- ============================================================
-- Migration 015 — staff tier, removing people, demo mode
--
-- 1. is_staff — a flag alongside role, so paid staff get the Staff section.
--    A Team Lead can also be staff; a volunteer never is.
-- 2. removed — take someone off the team without destroying their history.
-- 3. Demo mode for the platform team: spin up a fully populated fake church.
--
-- Run once in the SQL Editor. Idempotent.
-- ============================================================

-- ── Staff tier ───────────────────────────────────────────
alter table profiles add column if not exists is_staff boolean not null default false;

-- Admins and pastors are staff by definition.
update profiles set is_staff = true where role in ('admin','pastor') and is_staff = false;

create or replace function is_staff_member()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.is_staff or p.role in ('admin','pastor')
      from profiles p where p.id = auth.uid()
  ), false)
$$;

-- ── Removing someone from the church ─────────────────────
-- Deactivates rather than deletes, so chat history and past rosters survive.
alter table profiles add column if not exists removed boolean not null default false;

create or replace function remove_member(target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t profiles;
begin
  if current_role_of() <> 'admin' then
    raise exception 'Only an admin can remove someone from the church';
  end if;
  select * into t from profiles where id = target;
  if t.id is null or t.org_id <> current_org() then
    raise exception 'That person is not in your church';
  end if;
  if t.id = auth.uid() then
    raise exception 'You cannot remove yourself';
  end if;

  update profiles set removed = true, approved = false where id = target;
  -- Free up anything they were scheduled for, and drop private chat access.
  update assignments set member_id = null
   where member_id = target and date >= current_date;
  delete from channel_members where member_id = target;
  delete from availability where member_id = target and date >= current_date;
end $$;
grant execute on function remove_member(uuid) to authenticated;

create or replace function restore_member(target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if current_role_of() <> 'admin' then
    raise exception 'Only an admin can restore someone';
  end if;
  update profiles set removed = false, approved = true
   where id = target and org_id = current_org();
end $$;
grant execute on function restore_member(uuid) to authenticated;

-- Removed people disappear from the directory (admins still see them to restore).
drop policy if exists "read profiles" on profiles;
create policy "read profiles" on profiles for select using (
  id = auth.uid()
  or (org_id = current_org() and (removed = false or current_role_of() = 'admin'))
);

-- Only an admin may set is_staff / removed, and never on themselves for removed.
create or replace function lock_department()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is null then
    return new;  -- direct database access is trusted
  end if;

  if new.platform_admin is distinct from old.platform_admin then
    raise exception 'platform_admin can only be changed directly in the database';
  end if;

  if old.org_id is null then
    return new;  -- mid-onboarding
  end if;

  if current_role_of() <> 'admin' then
    if new.department is distinct from old.department then
      raise exception 'Only an admin can change a department';
    end if;
    if new.approved is distinct from old.approved then
      raise exception 'Only an admin can approve accounts';
    end if;
    if new.is_staff is distinct from old.is_staff then
      raise exception 'Only an admin can change staff access';
    end if;
    if new.removed is distinct from old.removed then
      raise exception 'Only an admin can remove someone';
    end if;
  end if;

  if new.org_id is distinct from old.org_id then
    raise exception 'A member cannot be moved between churches';
  end if;

  return new;
end $$;
drop trigger if exists profiles_dept_lock on profiles;
create trigger profiles_dept_lock before update on profiles
  for each row execute function lock_department();

-- ── Staff-only resources ─────────────────────────────────
alter table resources add column if not exists staff_only boolean not null default false;

drop policy if exists "read resources" on resources;
create policy "read resources" on resources for select using (
  org_id = current_org()
  and (staff_only = false or is_staff_member())
  and (department is null
       or current_role_of() = 'admin'
       or department = (select department from profiles where id = auth.uid()))
);

-- ── Demo mode (platform team only) ───────────────────────
alter table organizations add column if not exists is_demo boolean not null default false;

-- Builds a complete fake church you own, so you can walk the whole product:
-- departments, chats, fake volunteers, a roster, an event and a meeting.
create or replace function create_demo_church(demo_name text default 'Demo Community Church')
returns json language plpgsql security definer set search_path = public as $$
declare
  org organizations;
  d text;
  sunday date := current_date + ((7 - extract(dow from current_date)::int) % 7);
  names text[] := array['Avery Blake','Jordan Reese','Sam Ellis','Casey Moore',
                        'Riley Chen','Drew Parker','Quinn Hayes','Morgan Lee'];
  roles text[] := array['lead','volunteer','volunteer','staff_flag',
                        'volunteer','lead','volunteer','volunteer'];
  i int;
  new_id uuid;
begin
  if not is_platform_admin() then
    raise exception 'Only the platform team can create demo churches';
  end if;

  insert into organizations (name, invite_code, plan, status, trial_ends_at,
                             setup_complete, is_demo)
    values (demo_name, gen_invite_code(), 'growth', 'trialing',
            now() + interval '14 days', true, true)
    returning * into org;

  -- Ministries + a chat for each
  foreach d in array array['Creative','Worship','Kids','Youth','Hospitality']
  loop
    insert into departments (org_id, name) values (org.id, d)
      on conflict (org_id, name) do nothing;
    insert into channels (name, kind, description, everyone, department, org_id)
      values (d, 'department', d || ' team chat.', false, d, org.id);
  end loop;

  insert into channels (name, kind, description, everyone, org_id) values
    ('Announcements', 'announcement', 'Church-wide announcements.', true, org.id),
    ('Staff', 'team', 'Staff and leadership.', true, org.id);

  -- Fake people. These have no auth login — they exist to populate the UI.
  for i in 1 .. array_length(names, 1) loop
    new_id := gen_random_uuid();
    insert into profiles (id, name, email, role, department, org_id, approved,
                          is_staff, avatar_color)
      values (
        new_id,
        names[i],
        lower(replace(names[i], ' ', '.')) || '@demo.test',
        case when roles[i] = 'staff_flag' then 'lead' else roles[i] end,
        (array['Creative','Worship','Kids','Youth','Hospitality'])[1 + (i % 5)],
        org.id, true,
        roles[i] = 'staff_flag',
        (array['#12a6db','#7c3aed','#db2777','#ea580c','#16a34a','#0891b2'])[1 + (i % 6)]
      );
  end loop;

  -- A roster for this Sunday, half filled
  insert into assignments (org_id, date, department, position, member_id, time, published)
  select org.id, sunday, 'Creative', pos,
         case when idx <= 2
              then (select id from profiles where org_id = org.id
                     and department = 'Creative' offset (idx - 1) limit 1)
              else null end,
         '9:00 AM', true
    from unnest(array['Camera 1','Livestream','Photos','Social']) with ordinality as t(pos, idx);

  -- An event and a staff meeting to make the calendar look alive
  insert into events (org_id, title, category, date, time, location, notes)
    values (org.id, 'Sunday Service', 'service', sunday, '10:00 AM',
            'Main Auditorium', 'Demo data — safe to change or delete.');

  insert into meetings (org_id, kind, title, date, owner_id)
    values (org.id, 'staff', 'Weekly Staff Meeting', sunday - 4, auth.uid());

  return json_build_object('id', org.id, 'name', org.name,
                           'invite_code', org.invite_code);
end $$;
grant execute on function create_demo_church(text) to authenticated;

-- Move yourself into a church you own, for testing. Platform team only, and
-- only into a demo church — never a real one.
create or replace function demo_switch_church(target_org uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o organizations;
begin
  if not is_platform_admin() then
    raise exception 'Only the platform team can switch churches';
  end if;
  select * into o from organizations where id = target_org;
  if o.id is null then raise exception 'No such church'; end if;
  if not o.is_demo then
    raise exception 'You can only switch into a demo church';
  end if;

  update profiles
     set org_id = target_org, role = 'admin', approved = true, is_staff = true,
         removed = false
   where id = auth.uid();
end $$;
grant execute on function demo_switch_church(uuid) to authenticated;

-- Delete a demo church entirely (cascades its data).
create or replace function delete_demo_church(target_org uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o organizations;
begin
  if not is_platform_admin() then raise exception 'Not authorized'; end if;
  select * into o from organizations where id = target_org;
  if o.id is null then return; end if;
  if not o.is_demo then raise exception 'Only demo churches can be deleted here'; end if;
  -- Don't strand yourself inside a church you're deleting.
  if (select org_id from profiles where id = auth.uid()) = target_org then
    raise exception 'Switch to another church before deleting this one';
  end if;
  delete from organizations where id = target_org;
end $$;
grant execute on function delete_demo_church(uuid) to authenticated;

-- Let the platform team change their own role while testing a demo church.
create or replace function demo_set_my_role(new_role text, staff boolean default null)
returns void language plpgsql security definer set search_path = public as $$
declare o organizations;
begin
  if not is_platform_admin() then raise exception 'Not authorized'; end if;
  select * into o from organizations
   where id = (select org_id from profiles where id = auth.uid());
  if o.id is null or not o.is_demo then
    raise exception 'Role switching only works inside a demo church';
  end if;
  if new_role not in ('admin','pastor','lead','volunteer') then
    raise exception 'Unknown role';
  end if;
  update profiles
     set role = new_role::user_role,
         is_staff = coalesce(staff, new_role in ('admin','pastor'))
   where id = auth.uid();
end $$;
grant execute on function demo_set_my_role(text, boolean) to authenticated;
