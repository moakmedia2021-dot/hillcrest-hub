-- ============================================================
-- Migration 012 — real notifications (web push + email)
--
-- Stores each person's push subscriptions and their notification
-- preferences, plus an outbox the app writes to and the sender drains.
--
-- Run once in the SQL Editor. Idempotent.
-- ============================================================

-- ── Devices a person has allowed notifications on ────────
create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table push_subscriptions enable row level security;

drop policy if exists "manage own push subs" on push_subscriptions;
create policy "manage own push subs" on push_subscriptions for all
  using (member_id = auth.uid()) with check (member_id = auth.uid());

-- ── What each person wants to be told about ──────────────
alter table profiles add column if not exists notify_push  boolean not null default true;
alter table profiles add column if not exists notify_email boolean not null default true;

-- ── Outbox: queued notifications ─────────────────────────
-- The app inserts rows; the /api/notifications/send route delivers them.
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade
             default current_org(),
  member_id  uuid not null references profiles(id) on delete cascade,
  title      text not null,
  body       text,
  href       text,
  kind       text not null default 'general',
  sent_push  boolean not null default false,
  sent_email boolean not null default false,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_member_idx
  on notifications (member_id, created_at desc);

alter table notifications enable row level security;

drop policy if exists "read own notifications" on notifications;
create policy "read own notifications" on notifications for select
  using (member_id = auth.uid());

drop policy if exists "update own notifications" on notifications;
create policy "update own notifications" on notifications for update
  using (member_id = auth.uid()) with check (member_id = auth.uid());

-- Leads and up can notify people in their church.
drop policy if exists "send notifications" on notifications;
create policy "send notifications" on notifications for insert with check (
  org_id = current_org()
  and current_role_of() in ('admin','pastor','lead')
  and exists (select 1 from profiles p
               where p.id = member_id and p.org_id = current_org())
);

-- ── Notify a whole roster when it's published ────────────
create or replace function notify_roster(the_date date, dept text)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0; a record;
begin
  if current_role_of() not in ('admin','pastor','lead') then
    raise exception 'Not authorized';
  end if;
  for a in
    select * from assignments
     where date = the_date and department = dept
       and member_id is not null and org_id = current_org()
  loop
    insert into notifications (org_id, member_id, title, body, href, kind)
      values (current_org(), a.member_id,
              'You''re serving ' || to_char(the_date, 'Mon DD'),
              a.position || coalesce(' · ' || a.time, ''),
              '/my-sunday', 'roster');
    n := n + 1;
  end loop;
  return n;
end $$;
grant execute on function notify_roster(date, text) to authenticated;

-- ── Tell the department when someone needs a sub ─────────
create or replace function notify_sub_request(req_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0; a assignments; p record;
begin
  select asg.* into a from sub_requests s
    join assignments asg on asg.id = s.assignment_id
   where s.id = req_id;
  if a.id is null then return 0; end if;
  if a.org_id <> current_org() then raise exception 'Not authorized'; end if;

  for p in
    select id from profiles
     where org_id = current_org() and department = a.department
       and id <> auth.uid() and approved = true
  loop
    insert into notifications (org_id, member_id, title, body, href, kind)
      values (current_org(), p.id, 'A teammate needs cover',
              a.position || ' on ' || to_char(a.date, 'Mon DD'),
              '/my-sunday', 'sub');
    n := n + 1;
  end loop;
  return n;
end $$;
grant execute on function notify_sub_request(uuid) to authenticated;

-- ── Realtime ─────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and tablename='notifications') then
    alter publication supabase_realtime add table notifications; end if;
end $$;
