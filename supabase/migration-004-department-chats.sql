-- ============================================================
-- Migration 004 — department-linked chats
-- Run once in the Hillcrest Hub project SQL Editor (ref qfsnwswiorjjqmzrbhea).
-- Idempotent.
-- ============================================================

-- A channel can be tied to a department; everyone in that department sees it.
alter table channels add column if not exists department text;

-- Extend visibility: everyone / admin / explicit member / same department.
create or replace function is_channel_visible(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from channels c
    where c.id = cid
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

-- Wire up the example department chats so the right people unlock them.
update channels set department = 'Creative' where name = 'Creative Team' and department is null;
update channels set department = 'Worship'  where name = 'Worship'       and department is null;

-- ── Lock: only admins can change a profile's department (DB-enforced) ──
create or replace function lock_department()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.department is distinct from old.department and current_role_of() <> 'admin' then
    raise exception 'Only an admin can change a department';
  end if;
  return new;
end; $$;
drop trigger if exists profiles_dept_lock on profiles;
create trigger profiles_dept_lock before update on profiles
  for each row execute function lock_department();
