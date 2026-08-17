-- ============================================================
-- Migration 014 — fix the meetings read policy
--
-- The SELECT policy called can_see_meeting(id), which re-queries the
-- meetings table. That function is STABLE, so inside a single statement it
-- sees the pre-statement snapshot — meaning a row inserted with
-- "return=representation" fails its own read check (403), even though the
-- insert itself is allowed.
--
-- Fix: express the read rule directly on the row's own columns. Same rules,
-- no self-query. can_see_meeting stays for the CHILD tables, where the parent
-- meeting is always already committed.
--
-- Run once in the SQL Editor. Idempotent.
-- ============================================================

drop policy if exists "read meetings" on meetings;
create policy "read meetings" on meetings for select using (
  org_id = current_org()
  and (
    -- 1-on-1s: only the two people in the room
    (kind = 'one_on_one' and (owner_id = auth.uid() or with_id = auth.uid()))
    -- staff meetings: leadership, scoped to department when one is set
    or (
      kind = 'staff'
      and current_role_of() in ('admin','pastor','lead')
      and (
        department is null
        or department = (select p.department from profiles p where p.id = auth.uid())
      )
    )
  )
);

-- Same reasoning for UPDATE (it also re-reads the row).
drop policy if exists "update meetings" on meetings;
create policy "update meetings" on meetings for update
using (
  org_id = current_org()
  and (
    (kind = 'one_on_one' and (owner_id = auth.uid() or with_id = auth.uid()))
    or (
      kind = 'staff'
      and current_role_of() in ('admin','pastor','lead')
      and (
        department is null
        or department = (select p.department from profiles p where p.id = auth.uid())
      )
    )
  )
)
with check (
  org_id = current_org()
  and (
    (kind = 'one_on_one' and (owner_id = auth.uid() or with_id = auth.uid()))
    or (
      kind = 'staff'
      and current_role_of() in ('admin','pastor','lead')
      and (
        department is null
        or department = (select p.department from profiles p where p.id = auth.uid())
      )
    )
  )
);

-- Clean up rows created while verifying.
delete from meetings where title in ('T', 'T2', 'NoOrg', 'NoOrgRep', 'Private check-in');
delete from assignments where position = 'Control Test';
