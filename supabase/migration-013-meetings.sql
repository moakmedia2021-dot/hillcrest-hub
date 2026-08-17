-- ============================================================
-- Migration 013 — staff meetings + 1-on-1s
--
-- Closes the meeting loop:
--   agenda (built all week) -> notes -> action items -> reviewed next time
--
-- 1-on-1 privacy: shared notes are visible only to the two people in the
-- meeting. Private notes are visible ONLY to their author. Church admins
-- deliberately cannot read either — same posture as deleted chat messages.
--
-- Run once in the SQL Editor. Idempotent.
-- ============================================================

-- ── Meetings ─────────────────────────────────────────────
-- kind 'staff'  = a team meeting; visible to the church (or a department)
-- kind 'one_on_one' = between owner_id and with_id only
create table if not exists meetings (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade
             default current_org(),
  kind       text not null default 'staff' check (kind in ('staff','one_on_one')),
  title      text not null,
  date       date not null,
  department text,
  owner_id   uuid references profiles(id) on delete set null,
  with_id    uuid references profiles(id) on delete cascade, -- 1-on-1 partner
  notes      text,          -- shared notes
  created_at timestamptz not null default now()
);
create index if not exists meetings_org_date_idx on meetings (org_id, date desc);
alter table meetings enable row level security;

-- Am I allowed to see this meeting?
create or replace function can_see_meeting(m_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from meetings m
    where m.id = m_id
      and m.org_id = current_org()
      and (
        -- 1-on-1s: only the two people in the room
        (m.kind = 'one_on_one' and (m.owner_id = auth.uid() or m.with_id = auth.uid()))
        -- staff meetings: leadership, scoped to department when set
        or (m.kind = 'staff'
            and current_role_of() in ('admin','pastor','lead')
            and (m.department is null
                 or m.department = (select department from profiles where id = auth.uid())))
      )
  )
$$;

drop policy if exists "read meetings" on meetings;
create policy "read meetings" on meetings for select using (can_see_meeting(id));

drop policy if exists "create meetings" on meetings;
create policy "create meetings" on meetings for insert with check (
  org_id = current_org()
  and owner_id = auth.uid()
  and (kind = 'one_on_one' or current_role_of() in ('admin','pastor','lead'))
);

drop policy if exists "update meetings" on meetings;
create policy "update meetings" on meetings for update
  using (can_see_meeting(id)) with check (can_see_meeting(id));

drop policy if exists "delete meetings" on meetings;
create policy "delete meetings" on meetings for delete
  using (owner_id = auth.uid());

-- ── Agenda items (carry over until discussed) ────────────
create table if not exists agenda_items (
  id          uuid primary key default gen_random_uuid(),
  meeting_id  uuid not null references meetings(id) on delete cascade,
  text        text not null,
  added_by    uuid references profiles(id) on delete set null,
  discussed   boolean not null default false,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
alter table agenda_items enable row level security;

drop policy if exists "read agenda" on agenda_items;
create policy "read agenda" on agenda_items for select
  using (can_see_meeting(meeting_id));
drop policy if exists "write agenda" on agenda_items;
create policy "write agenda" on agenda_items for all
  using (can_see_meeting(meeting_id)) with check (can_see_meeting(meeting_id));

-- ── Action items — become real tasks ─────────────────────
create table if not exists action_items (
  id          uuid primary key default gen_random_uuid(),
  meeting_id  uuid not null references meetings(id) on delete cascade,
  text        text not null,
  assignee_id uuid references profiles(id) on delete set null,
  due_date    date,
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table action_items enable row level security;

drop policy if exists "read actions" on action_items;
create policy "read actions" on action_items for select
  using (can_see_meeting(meeting_id));
drop policy if exists "write actions" on action_items;
create policy "write actions" on action_items for all
  using (can_see_meeting(meeting_id)) with check (can_see_meeting(meeting_id));

-- ── Private notes — author only, never anyone else ───────
create table if not exists private_notes (
  id         uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  author_id  uuid not null references profiles(id) on delete cascade,
  body       text not null default '',
  updated_at timestamptz not null default now(),
  unique (meeting_id, author_id)
);
alter table private_notes enable row level security;

drop policy if exists "own private notes" on private_notes;
create policy "own private notes" on private_notes for all
  using (author_id = auth.uid()) with check (author_id = auth.uid());

-- ── Goals tracked in 1-on-1s ─────────────────────────────
create table if not exists goals (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade
             default current_org(),
  member_id  uuid not null references profiles(id) on delete cascade,
  text       text not null,
  status     text not null default 'active'
             check (status in ('active','done','dropped')),
  created_at timestamptz not null default now()
);
alter table goals enable row level security;

-- Yours, or your supervisor's view of yours (anyone who has a 1-on-1 with you).
drop policy if exists "read goals" on goals;
create policy "read goals" on goals for select using (
  member_id = auth.uid()
  or exists (select 1 from meetings m
              where m.kind = 'one_on_one'
                and m.org_id = current_org()
                and ((m.owner_id = auth.uid() and m.with_id = goals.member_id)
                  or (m.with_id = auth.uid() and m.owner_id = goals.member_id)))
);
drop policy if exists "write goals" on goals;
create policy "write goals" on goals for all using (
  member_id = auth.uid()
  or exists (select 1 from meetings m
              where m.kind = 'one_on_one'
                and m.org_id = current_org()
                and m.owner_id = auth.uid() and m.with_id = goals.member_id)
) with check (org_id = current_org());

-- ── Push an action item onto the production board ────────
create or replace function action_to_task(item_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare it action_items; new_id uuid;
begin
  select * into it from action_items where id = item_id;
  if it.id is null then raise exception 'That action item no longer exists'; end if;
  if not can_see_meeting(it.meeting_id) then raise exception 'Not authorized'; end if;

  insert into tasks (title, stage, assignee_id, due_date, org_id)
    values (it.text, 'idea', it.assignee_id, it.due_date, current_org())
    returning id into new_id;
  return new_id;
end $$;
grant execute on function action_to_task(uuid) to authenticated;

-- ── Realtime ─────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and tablename='meetings') then
    alter publication supabase_realtime add table meetings; end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and tablename='agenda_items') then
    alter publication supabase_realtime add table agenda_items; end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and tablename='action_items') then
    alter publication supabase_realtime add table action_items; end if;
end $$;
