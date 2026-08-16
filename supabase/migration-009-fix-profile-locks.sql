-- ============================================================
-- Migration 009 — fix the profile lock trigger
--
-- Two bugs in 008:
--   1. The platform_admin guard fired for EVERY update, including ones run
--      directly in the SQL editor — which made it impossible to grant
--      platform access at all.
--   2. create_organization sets approved = true while the caller is still a
--      plain volunteer, so the "only an admin can approve" guard rejected it
--      and creating a new church failed.
--
-- The rule now: direct database access is trusted; the app is not. And a
-- profile that has no church yet is mid-onboarding, so it may be assigned one.
--
-- Run once in the SQL Editor. Idempotent.
-- ============================================================

create or replace function lock_department()
returns trigger language plpgsql set search_path = public as $$
begin
  -- Direct database access (SQL editor / service role) has no auth.uid().
  -- It is trusted and bypasses these app-level guards — this is how platform
  -- admin is granted.
  if auth.uid() is null then
    return new;
  end if;

  -- Never settable from inside the app, in any state.
  if new.platform_admin is distinct from old.platform_admin then
    raise exception 'platform_admin can only be changed directly in the database';
  end if;

  -- Mid-onboarding: a profile with no church is being assigned one by
  -- create_organization / join_organization.
  if old.org_id is null then
    return new;
  end if;

  if current_role_of() <> 'admin' then
    if new.department is distinct from old.department then
      raise exception 'Only an admin can change a department';
    end if;
    if new.approved is distinct from old.approved then
      raise exception 'Only an admin can approve accounts';
    end if;
  end if;

  -- Once you belong to a church, nothing in the app moves you to another.
  if new.org_id is distinct from old.org_id then
    raise exception 'A member cannot be moved between churches';
  end if;

  return new;
end $$;

drop trigger if exists profiles_dept_lock on profiles;
create trigger profiles_dept_lock before update on profiles
  for each row execute function lock_department();

-- ── Now grant yourself platform access ───────────────────
-- Edit the email if needed, then this will succeed:
update profiles set platform_admin = true
 where email = 'moakmedia2021@gmail.com';

-- Confirm it worked:
select name, email, platform_admin from profiles where platform_admin;
