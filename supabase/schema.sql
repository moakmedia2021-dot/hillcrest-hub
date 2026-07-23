-- ============================================================
-- Hillcrest Hub — Supabase schema
-- Run this in your Supabase project's SQL Editor (one time).
-- It creates the tables, a role enum, a profile-on-signup trigger,
-- and Row Level Security so each role only does what it should.
-- ============================================================

-- ── Roles ────────────────────────────────────────────────
create type user_role as enum ('admin', 'pastor', 'lead', 'volunteer');

-- ── Profiles (one row per auth user) ─────────────────────
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text not null,
  role         user_role not null default 'volunteer',
  department   text default 'Creative',
  title        text,
  email        text,
  phone        text,
  avatar_color text default '#12a6db',
  created_at   timestamptz not null default now()
);

-- Helper: current user's role (used by policies below).
create or replace function current_role_of()
returns user_role language sql stable security definer as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function has_perm(min_admin boolean)
returns boolean language sql stable as $$
  select current_role_of() = 'admin' or (not min_admin)
$$;

-- Auto-create a profile whenever someone signs up.
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email), new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Channels + membership ────────────────────────────────
create table channels (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        text not null check (kind in ('announcement','team','department','direct')),
  description text,
  everyone    boolean not null default false,   -- true = visible to all
  created_at  timestamptz not null default now()
);

create table channel_members (
  channel_id uuid references channels(id) on delete cascade,
  member_id  uuid references profiles(id) on delete cascade,
  primary key (channel_id, member_id)
);

-- ── Messages ─────────────────────────────────────────────
create table messages (
  id         uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  author_id  uuid not null references profiles(id) on delete cascade,
  body       text not null,
  pinned     boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── Production tasks ─────────────────────────────────────
create table tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  stage       text not null default 'idea'
              check (stage in ('idea','filming','editing','review','scheduled','posted')),
  assignee_id uuid references profiles(id) on delete set null,
  due_date    date,
  platform    text,
  created_at  timestamptz not null default now()
);

-- ── Events + event tasks ─────────────────────────────────
create table events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  category    text not null default 'service',
  date        date not null,
  time        text,
  location    text,
  owner_id    uuid references profiles(id) on delete set null,
  template_id text,
  notes       text,
  created_at  timestamptz not null default now()
);

create table event_tasks (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  label       text not null,
  done        boolean not null default false,
  assignee_id uuid references profiles(id) on delete set null,
  due_date    date,
  sort        int not null default 0
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table profiles        enable row level security;
alter table channels        enable row level security;
alter table channel_members enable row level security;
alter table messages        enable row level security;
alter table tasks           enable row level security;
alter table events          enable row level security;
alter table event_tasks     enable row level security;

-- Profiles: everyone signed in can read the directory; only admins change roles;
-- you can edit your own basic profile.
create policy "read profiles"   on profiles for select using (auth.role() = 'authenticated');
create policy "admin write profiles" on profiles for all
  using (current_role_of() = 'admin') with check (current_role_of() = 'admin');
create policy "self update" on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- Channels & membership: readable by authenticated users; managed by admins/pastors.
create policy "read channels" on channels for select using (auth.role() = 'authenticated');
create policy "manage channels" on channels for all
  using (current_role_of() in ('admin','pastor'))
  with check (current_role_of() in ('admin','pastor'));
create policy "read membership" on channel_members for select using (auth.role() = 'authenticated');
create policy "manage membership" on channel_members for all
  using (current_role_of() in ('admin','pastor'))
  with check (current_role_of() in ('admin','pastor'));

-- Messages: readable by authenticated; anyone can post to non-announcement
-- channels; only admins/pastors can post to an announcement channel.
create policy "read messages" on messages for select using (auth.role() = 'authenticated');
create policy "post messages" on messages for insert with check (
  author_id = auth.uid()
  and (
    (select kind from channels c where c.id = channel_id) <> 'announcement'
    or current_role_of() in ('admin','pastor')
  )
);

-- Tasks & events: readable by all; write by admin/pastor/lead.
create policy "read tasks" on tasks for select using (auth.role() = 'authenticated');
create policy "write tasks" on tasks for all
  using (current_role_of() in ('admin','pastor','lead'))
  with check (current_role_of() in ('admin','pastor','lead'));

create policy "read events" on events for select using (auth.role() = 'authenticated');
create policy "write events" on events for all
  using (current_role_of() in ('admin','pastor','lead'))
  with check (current_role_of() in ('admin','pastor','lead'));

create policy "read event_tasks" on event_tasks for select using (auth.role() = 'authenticated');
create policy "write event_tasks" on event_tasks for all
  using (current_role_of() in ('admin','pastor','lead'))
  with check (current_role_of() in ('admin','pastor','lead'));

-- ── Realtime ─────────────────────────────────────────────
-- Enable realtime on the tables the UI subscribes to.
alter publication supabase_realtime add table messages, tasks, events, event_tasks;

-- ── Starter channels ─────────────────────────────────────
-- So chat works immediately. everyone=true means visible to all signed-in users.
-- (Tasks and events start empty — your team creates those in the app.)
insert into channels (name, kind, description, everyone) values
  ('Announcements', 'announcement', 'Church-wide announcements from leadership.', true),
  ('Creative Team', 'team',        'Video, photo, social, and design.',         true),
  ('Social Media',  'department',  'Planning and scheduling posts.',            true),
  ('Worship',       'department',  'Sunday sets and rehearsals.',               true);

-- ── First admin ──────────────────────────────────────────
-- After you sign up your own account IN THE APP, promote yourself here:
--   update profiles set role = 'admin' where email = 'you@example.com';
