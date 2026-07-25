-- ============================================================
-- Migration 006 — serving availability, event RSVPs, kudos
-- Run once in the Hillcrest Hub project SQL Editor (ref qfsnwswiorjjqmzrbhea).
-- Idempotent.
-- ============================================================

-- ── Serving availability ─────────────────────────────────
create table if not exists availability (
  member_id uuid references profiles(id) on delete cascade,
  date      date not null,
  primary key (member_id, date)
);
alter table availability enable row level security;
drop policy if exists "read availability" on availability;
create policy "read availability" on availability for select
  using (auth.role() = 'authenticated');
drop policy if exists "manage own availability" on availability;
create policy "manage own availability" on availability for all
  using (member_id = auth.uid()) with check (member_id = auth.uid());

-- ── Event RSVPs ──────────────────────────────────────────
create table if not exists event_rsvps (
  event_id  uuid references events(id) on delete cascade,
  member_id uuid references profiles(id) on delete cascade,
  status    text not null check (status in ('going','maybe','no')),
  primary key (event_id, member_id)
);
alter table event_rsvps enable row level security;
drop policy if exists "read rsvps" on event_rsvps;
create policy "read rsvps" on event_rsvps for select
  using (auth.role() = 'authenticated');
drop policy if exists "manage own rsvp" on event_rsvps;
create policy "manage own rsvp" on event_rsvps for all
  using (member_id = auth.uid()) with check (member_id = auth.uid());

-- ── Kudos / shout-outs ───────────────────────────────────
create table if not exists kudos (
  id         uuid primary key default gen_random_uuid(),
  from_id    uuid references profiles(id) on delete set null,
  to_id      uuid references profiles(id) on delete cascade,
  message    text not null,
  created_at timestamptz not null default now()
);
alter table kudos enable row level security;
drop policy if exists "read kudos" on kudos;
create policy "read kudos" on kudos for select
  using (auth.role() = 'authenticated');
drop policy if exists "give kudos" on kudos;
create policy "give kudos" on kudos for insert with check (from_id = auth.uid());

-- ── Realtime ─────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='availability') then
    alter publication supabase_realtime add table availability; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='event_rsvps') then
    alter publication supabase_realtime add table event_rsvps; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='kudos') then
    alter publication supabase_realtime add table kudos; end if;
end $$;
