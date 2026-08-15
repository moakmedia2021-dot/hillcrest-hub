-- ============================================================
-- Migration 008 — platform admin + subscriptions
--
-- Adds two things:
--   1. A platform-admin tier ABOVE church admins — for you and your internal
--      team who run the product itself. Granted ONLY by direct SQL, never
--      through the app, and never self-assignable.
--   2. Subscription state per church, so creating an organization goes
--      through a plan/paywall step.
--
-- Run once in the SQL Editor. Idempotent.
-- ============================================================

-- ── Platform admin flag ──────────────────────────────────
alter table profiles
  add column if not exists platform_admin boolean not null default false;

create or replace function is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select platform_admin from profiles where id = auth.uid()), false)
$$;

-- ── Subscription state on each church ────────────────────
alter table organizations add column if not exists plan text not null default 'starter';
alter table organizations add column if not exists status text not null default 'trialing';
alter table organizations add column if not exists trial_ends_at timestamptz;
alter table organizations add column if not exists activated_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'organizations_status_chk') then
    alter table organizations add constraint organizations_status_chk
      check (status in ('trialing','active','past_due','canceled','suspended'));
  end if;
end $$;

-- Existing churches keep working: give them an active subscription.
update organizations
   set status = 'active', activated_at = coalesce(activated_at, now())
 where status = 'trialing' and trial_ends_at is null;

-- ── Nobody can grant themselves platform admin ───────────
-- (also keeps the department / approval / church-move locks from 004–007)
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
  if old.org_id is not null and new.org_id is distinct from old.org_id then
    raise exception 'A member cannot be moved between churches';
  end if;
  -- platform_admin is granted by direct SQL only — never through the app.
  if new.platform_admin is distinct from old.platform_admin then
    raise exception 'platform_admin can only be changed directly in the database';
  end if;
  return new;
end $$;
drop trigger if exists profiles_dept_lock on profiles;
create trigger profiles_dept_lock before update on profiles
  for each row execute function lock_department();

-- ── Platform admins can read every church ────────────────
drop policy if exists "read own org" on organizations;
create policy "read own org" on organizations for select
  using (id = current_org() or is_platform_admin());

-- ── Creating a church now records a plan + trial ─────────
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

  insert into organizations (name, invite_code, plan, status, trial_ends_at)
    values (trim(org_name), gen_invite_code(), coalesce(plan_name, 'starter'),
            'trialing', now() + interval '14 days')
    returning * into new_org;

  update profiles
     set org_id = new_org.id, role = 'admin', approved = true
   where id = auth.uid();

  insert into channels (name, kind, description, everyone, org_id) values
    ('Announcements', 'announcement', 'Church-wide announcements from leadership.', true, new_org.id),
    ('Staff', 'team', 'Staff and leadership.', true, new_org.id);

  return json_build_object('id', new_org.id, 'name', new_org.name,
                           'invite_code', new_org.invite_code,
                           'status', new_org.status,
                           'trial_ends_at', new_org.trial_ends_at);
end $$;
grant execute on function create_organization(text, text) to authenticated;

-- ── TEST-MODE activation ─────────────────────────────────
-- Marks the church's subscription active without taking payment. This is the
-- seam where a real Stripe checkout webhook will write instead.
create or replace function activate_subscription_test(plan_name text)
returns json language plpgsql security definer set search_path = public as $$
declare updated organizations;
begin
  if current_role_of() <> 'admin' then
    raise exception 'Only a church admin can change the plan';
  end if;
  update organizations
     set plan = coalesce(plan_name, plan),
         status = 'active',
         activated_at = now()
   where id = current_org()
   returning * into updated;
  return json_build_object('plan', updated.plan, 'status', updated.status);
end $$;
grant execute on function activate_subscription_test(text) to authenticated;

-- ── Platform overview (the internal App Admin dashboard) ──
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

-- Platform admins can change any church's subscription status.
create or replace function platform_set_org_status(target_org uuid, new_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  update organizations set status = new_status where id = target_org;
end $$;
grant execute on function platform_set_org_status(uuid, text) to authenticated;

-- ============================================================
-- GRANT YOURSELF PLATFORM ADMIN — run this once, with your email:
--
--   update profiles set platform_admin = true
--    where email = 'moakmedia2021@gmail.com';
--
-- Add teammates the same way. There is deliberately no way to do this
-- from inside the app.
-- ============================================================
