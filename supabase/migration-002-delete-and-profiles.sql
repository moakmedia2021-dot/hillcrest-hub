-- ============================================================
-- Migration 002 — chat soft-delete + profile fields
-- Run once in the Hillcrest Hub project SQL Editor (ref qfsnwswiorjjqmzrbhea).
-- Safe to re-run (idempotent).
-- ============================================================

-- ── Chat soft-delete ─────────────────────────────────────
alter table messages add column if not exists deleted boolean not null default false;
alter table messages add column if not exists deleted_by uuid references profiles(id);
alter table messages add column if not exists deleted_at timestamptz;

-- Admin-only store of the original (deleted) content. Non-admins can never read it.
create table if not exists message_deletions (
  message_id   uuid primary key references messages(id) on delete cascade,
  original_body text not null,
  deleted_by   uuid references profiles(id),
  deleted_at   timestamptz not null default now()
);
alter table message_deletions enable row level security;
drop policy if exists "admin read deletions" on message_deletions;
create policy "admin read deletions" on message_deletions for select
  using (current_role_of() = 'admin');

-- Author or admin may update a message (the delete path uses the RPC below).
drop policy if exists "update own or admin messages" on messages;
create policy "update own or admin messages" on messages for update
  using (author_id = auth.uid() or current_role_of() = 'admin')
  with check (author_id = auth.uid() or current_role_of() = 'admin');

-- Soft-delete RPC: copies body into the admin-only table, blanks it, marks deleted.
create or replace function delete_message(msg_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.messages;
begin
  select * into m from public.messages where id = msg_id;
  if m.id is null then return; end if;
  if m.author_id <> auth.uid() and current_role_of() <> 'admin' then
    raise exception 'not allowed to delete this message';
  end if;
  insert into public.message_deletions (message_id, original_body, deleted_by)
    values (m.id, m.body, auth.uid())
    on conflict (message_id) do nothing;
  update public.messages
    set body = '', deleted = true, deleted_by = auth.uid(), deleted_at = now()
    where id = m.id;
end; $$;
grant execute on function delete_message(uuid) to authenticated;

-- ── Profile fields ───────────────────────────────────────
alter table profiles add column if not exists username text;
alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists bio text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_key') then
    alter table profiles add constraint profiles_username_key unique (username);
  end if;
end $$;

-- ── Avatars storage bucket (public read, owner-only write) ──
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

drop policy if exists "avatar public read" on storage.objects;
create policy "avatar public read" on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatar owner insert" on storage.objects;
create policy "avatar owner insert" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar owner update" on storage.objects;
create policy "avatar owner update" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
