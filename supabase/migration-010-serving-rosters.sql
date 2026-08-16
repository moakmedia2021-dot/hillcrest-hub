-- ============================================================
-- Migration 010 — serving rosters + sub/swap requests
--
-- Closes the weekly church loop:
--   availability -> roster -> "My Sunday" -> "I can't make it" -> sub filled
--
-- Run once in the SQL Editor. Idempotent.
-- ============================================================

-- ── A single serving position on a given date ────────────
create table if not exists assignments (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade
             default current_org(),
  date       date not null,
  department text not null,
  position   text not null,               -- "Camera 1", "Kids Check-in", "Keys"
  member_id  uuid references profiles(id) on delete set null,  -- null = open
  time       text,
  location   text,
  notes      text,
  published  boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists assignments_org_date_idx on assignments (org_id, date);

alter table assignments enable row level security;

-- Everyone in the church sees the roster; leads and up build it.
drop policy if exists "read assignments" on assignments;
create policy "read assignments" on assignments for select
  using (org_id = current_org());

drop policy if exists "write assignments" on assignments;
create policy "write assignments" on assignments for all
  using (org_id = current_org() and current_role_of() in ('admin','pastor','lead'))
  with check (org_id = current_org() and current_role_of() in ('admin','pastor','lead'));

-- ── "I can't make it" ────────────────────────────────────
create table if not exists sub_requests (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  requested_by  uuid references profiles(id) on delete set null,
  reason        text,
  status        text not null default 'open'
                check (status in ('open','filled','cancelled')),
  filled_by     uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
alter table sub_requests enable row level security;

drop policy if exists "read sub requests" on sub_requests;
create policy "read sub requests" on sub_requests for select using (
  exists (select 1 from assignments a
           where a.id = assignment_id and a.org_id = current_org())
);

-- ── Ask for a sub (only for your own assignment) ─────────
create or replace function request_sub(assignment uuid, why text default null)
returns json language plpgsql security definer set search_path = public as $$
declare a assignments; req sub_requests;
begin
  select * into a from assignments where id = assignment;
  if a.id is null then raise exception 'That assignment no longer exists'; end if;
  if a.org_id <> current_org() then raise exception 'Not authorized'; end if;
  if a.member_id <> auth.uid() and current_role_of() not in ('admin','pastor','lead') then
    raise exception 'You can only request a sub for your own slot';
  end if;
  if exists (select 1 from sub_requests s
              where s.assignment_id = assignment and s.status = 'open') then
    raise exception 'A sub request is already open for this slot';
  end if;

  insert into sub_requests (assignment_id, requested_by, reason)
    values (assignment, auth.uid(), nullif(trim(coalesce(why,'')), ''))
    returning * into req;
  return json_build_object('id', req.id, 'status', req.status);
end $$;
grant execute on function request_sub(uuid, text) to authenticated;

-- ── Take someone's slot ──────────────────────────────────
-- First to accept wins; the row lock makes that race-safe.
create or replace function accept_sub_request(req_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare req sub_requests; a assignments;
begin
  select * into req from sub_requests where id = req_id for update;
  if req.id is null then raise exception 'That request no longer exists'; end if;
  if req.status <> 'open' then raise exception 'Someone already covered this slot'; end if;

  select * into a from assignments where id = req.assignment_id;
  if a.org_id <> current_org() then raise exception 'Not authorized'; end if;
  if a.member_id = auth.uid() then raise exception 'That slot is already yours'; end if;

  update assignments set member_id = auth.uid() where id = a.id;
  update sub_requests
     set status = 'filled', filled_by = auth.uid()
   where id = req.id;

  return json_build_object('assignment_id', a.id, 'status', 'filled');
end $$;
grant execute on function accept_sub_request(uuid) to authenticated;

-- ── Withdraw a request ───────────────────────────────────
create or replace function cancel_sub_request(req_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare req sub_requests;
begin
  select * into req from sub_requests where id = req_id;
  if req.id is null then return; end if;
  if req.requested_by <> auth.uid() and current_role_of() not in ('admin','pastor','lead') then
    raise exception 'Not authorized';
  end if;
  update sub_requests set status = 'cancelled' where id = req_id;
end $$;
grant execute on function cancel_sub_request(uuid) to authenticated;

-- ── Realtime ─────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and tablename='assignments') then
    alter publication supabase_realtime add table assignments; end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and tablename='sub_requests') then
    alter publication supabase_realtime add table sub_requests; end if;
end $$;
