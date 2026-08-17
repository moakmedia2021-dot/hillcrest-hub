-- ============================================================
-- Migration 017 — let demo churches have people
--
-- create_demo_church() inserts fake members so a demo church looks alive.
-- But profiles.id had "references auth.users(id)", so every fake member
-- violated that foreign key and the whole function rolled back — which is
-- why Demo mode refused to add a church.
--
-- Real signups are unaffected: handle_new_user() still inserts the profile
-- with id = the new auth user's id. We just no longer require every profile
-- row to have a login behind it.
--
-- The FK also gave us "delete the auth user → delete the profile". A trigger
-- below preserves exactly that, so nothing is lost by dropping it.
--
-- Run once in the SQL Editor. Idempotent.
-- ============================================================

-- 1. Drop the constraint that blocked login-less profiles.
alter table profiles drop constraint if exists profiles_id_fkey;

-- 2. Keep the cascade we just gave up: deleting a login removes its profile.
create or replace function delete_profile_for_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.profiles where id = old.id;
  return old;
end $$;

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute function delete_profile_for_user();

-- 3. Demo member emails were "avery.blake@demo.test" — identical in every
--    demo church, so a second demo church created colliding people. Tag them
--    with the org's invite code so each church's set is distinct.
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
  depts text[] := array['Creative','Worship','Kids','Youth','Hospitality'];
  i int;
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
  foreach d in array depts
  loop
    insert into departments (org_id, name) values (org.id, d)
      on conflict (org_id, name) do nothing;
    insert into channels (name, kind, description, everyone, department, org_id)
      values (d, 'department', d || ' team chat.', false, d, org.id);
  end loop;

  insert into channels (name, kind, description, everyone, org_id) values
    ('Announcements', 'announcement', 'Church-wide announcements.', true, org.id),
    ('Staff', 'team', 'Staff and leadership.', true, org.id);

  -- Fake people. These have no auth login — they exist to populate the UI,
  -- which is only possible now that profiles.id is not tied to auth.users.
  for i in 1 .. array_length(names, 1) loop
    insert into profiles (id, name, email, role, department, org_id, approved,
                          is_staff, avatar_color)
      values (
        gen_random_uuid(),
        names[i],
        lower(replace(names[i], ' ', '.')) || '+' || lower(org.invite_code) || '@demo.test',
        case when roles[i] = 'staff_flag' then 'lead' else roles[i] end,
        depts[1 + (i % 5)],
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

  insert into events (org_id, title, category, date, time, location, notes)
    values (org.id, 'Sunday Service', 'service', sunday, '10:00 AM',
            'Main Auditorium', 'Demo data — safe to change or delete.');

  insert into meetings (org_id, kind, title, date, owner_id)
    values (org.id, 'staff', 'Weekly Staff Meeting', sunday - 4, auth.uid());

  return json_build_object('org_id', org.id, 'name', org.name,
                           'invite_code', org.invite_code);
end $$;

grant execute on function create_demo_church(text) to authenticated;

-- 4. platform_overview() never returned is_demo, so Demo Mode had to guess
--    which churches were demos by looking for "demo" in the name. Any demo
--    church named something else was created but never listed — it looked
--    like creation had failed. Return the flag so the UI can filter honestly.
create or replace function platform_overview()
returns json language plpgsql security definer set search_path = public as $$
declare result json;
begin
  if not is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  select json_build_object(
    'orgs', coalesce((
      select json_agg(row_to_json(o) order by o.created_at desc) from (
        select org.id, org.name, org.invite_code, org.plan, org.status,
               org.trial_ends_at, org.created_at,
               coalesce(org.is_demo, false) as is_demo,
               (select count(*) from profiles p where p.org_id = org.id) as members,
               (select count(*) from profiles p where p.org_id = org.id and p.approved = false) as pending,
               (select count(*) from messages m
                  join channels c on c.id = m.channel_id where c.org_id = org.id) as messages,
               (select count(*) from events e where e.org_id = org.id) as events,
               (select count(*) from tasks t where t.org_id = org.id) as tasks
          from organizations org
      ) o
    ), '[]'::json),
    'totals', (
      select json_build_object(
        'churches', (select count(*) from organizations),
        'members', (select count(*) from profiles where org_id is not null),
        'active', (select count(*) from organizations where status = 'active'),
        'trialing', (select count(*) from organizations where status = 'trialing')
      )
    )
  ) into result;
  return result;
end $$;
grant execute on function platform_overview() to authenticated;

-- Verify (as the platform admin):
-- select create_demo_church('Test Church A');
-- select create_demo_church('Test Church B');   -- must also succeed
-- select json_array_length((platform_overview()->'orgs')::json);
