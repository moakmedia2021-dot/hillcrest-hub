-- ============================================================
-- CLEAN SLATE — wipe every church and every account except yours.
--
-- ⚠️  THIS IS IRREVERSIBLE. Take a backup first:
--     Supabase Dashboard → Database → Backups → download a copy.
--
-- What survives: exactly one profile (KEEP_EMAIL below), its login,
-- and its platform_admin flag. Everything else goes.
--
-- Order matters, for two reasons:
--   • profiles.org_id cascades from organizations, so deleting churches
--     would delete YOUR profile too. Step 2 detaches you first.
--   • message_deletions.deleted_by has no ON DELETE action, so it blocks
--     profile deletes. Churches go first (step 3) which clears it.
--
-- Runs as one transaction: if any check fails, nothing is deleted.
-- ============================================================

-- ── PRE-FLIGHT: run this ALONE first to see what's about to be deleted ──
-- select
--   (select count(*) from organizations) as churches_to_delete,
--   (select count(*) from profiles
--     where lower(email) <> 'moakmedia2021@gmail.com') as people_to_delete,
--   (select count(*) from auth.users
--     where lower(email) <> 'moakmedia2021@gmail.com') as logins_to_delete,
--   (select string_agg(name, ', ') from organizations) as church_names;


begin;

-- 1. Guard. Abort unless exactly one profile matches the email to keep.
do $$
declare
  keep_email text := 'moakmedia2021@gmail.com';   -- ← the only account to keep
  n int;
begin
  select count(*) into n from profiles where lower(email) = lower(keep_email);
  if n <> 1 then
    raise exception
      'Expected exactly 1 profile for %, found %. Nothing deleted.', keep_email, n;
  end if;
end $$;

-- 2. Detach yourself from your church FIRST, or step 3 deletes you.
update profiles
   set org_id = null
 where lower(email) = lower('moakmedia2021@gmail.com');

-- 3. Delete every church. Cascades: channels, messages, message_deletions,
--    channel_members, tasks, events, event_tasks, event_rsvps, resources,
--    kudos, departments, assignments, sub_requests, meetings, agenda_items,
--    action_items, private_notes, goals, notifications — and every other
--    profile, since theirs still points at an org.
delete from organizations;

-- 4. Any profile that somehow survived (org_id was already null) and isn't you.
delete from profiles
 where lower(email) is distinct from lower('moakmedia2021@gmail.com');

-- 5. Delete the logins behind those accounts. Without this they could still
--    sign in, land with no profile, and create a brand-new church.
delete from auth.users
 where lower(email) is distinct from lower('moakmedia2021@gmail.com');

-- 6. Residue not tied to a church: these hang off your profile directly and
--    would otherwise survive as stale rows pointing at a church that's gone.
delete from availability;
delete from push_subscriptions;   -- your browser re-subscribes on next visit

-- 7. Put your account in a clean state, ready to create Hillcrest's hub.
update profiles
   set platform_admin = true,   -- you stay app admin
       approved       = true,
       removed        = false,
       role           = 'admin',
       is_staff       = true,
       org_id         = null    -- no church yet; the app will ask you to make one
 where lower(email) = lower('moakmedia2021@gmail.com');

commit;

-- ── Verify. Expect: 0 churches, 1 profile, 1 login, platform_admin = true ──
select
  (select count(*) from organizations)                      as churches,
  (select count(*) from profiles)                           as profiles,
  (select count(*) from auth.users)                         as logins,
  (select count(*) from channels)                           as channels,
  (select count(*) from messages)                           as messages,
  (select platform_admin from profiles limit 1)             as i_am_app_admin,
  (select org_id is null from profiles limit 1)             as ready_for_new_church;
