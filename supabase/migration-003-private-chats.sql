-- ============================================================
-- Migration 003 — private chats, clear-chat, profanity, images
-- Run once in the Hillcrest Hub project SQL Editor (ref qfsnwswiorjjqmzrbhea).
-- Idempotent.
-- ============================================================

-- Image attachments on messages
alter table messages add column if not exists image_url text;

-- ── Channel visibility helper (security definer avoids RLS recursion) ──
-- A channel is visible if it's marked everyone, you're a member, or you're admin.
create or replace function is_channel_visible(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from channels c
    where c.id = cid
      and (
        c.everyone = true
        or current_role_of() = 'admin'
        or exists (
          select 1 from channel_members cm
          where cm.channel_id = cid and cm.member_id = auth.uid()
        )
      )
  )
$$;

-- ── Private channel reads ──
drop policy if exists "read channels" on channels;
create policy "read channels" on channels for select
  using (is_channel_visible(id));

-- Membership rows: you see your own; admins see all.
drop policy if exists "read membership" on channel_members;
create policy "read membership" on channel_members for select
  using (member_id = auth.uid() or current_role_of() = 'admin');

-- ── Private message reads/writes ──
drop policy if exists "read messages" on messages;
create policy "read messages" on messages for select
  using (is_channel_visible(channel_id));

drop policy if exists "post messages" on messages;
create policy "post messages" on messages for insert with check (
  author_id = auth.uid()
  and is_channel_visible(channel_id)
  and (
    (select kind from channels c where c.id = channel_id) <> 'announcement'
    or current_role_of() in ('admin', 'pastor')
  )
);

-- ── Clear chat (admin only): permanently delete a channel's messages ──
create or replace function clear_channel(cid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if current_role_of() <> 'admin' then
    raise exception 'Only admins can clear a chat';
  end if;
  delete from messages where channel_id = cid;
end; $$;
grant execute on function clear_channel(uuid) to authenticated;

-- ── Server-side profanity guard (defense in depth; the app also blocks) ──
create or replace function check_profanity()
returns trigger language plpgsql set search_path = public as $$
declare norm text;
begin
  if new.body is null or new.body = '' then return new; end if;
  norm := lower(new.body);
  -- collapse common leetspeak substitutions
  norm := translate(norm, '0134$@578', 'oleasatb');
  -- keep only letters and single spaces so word boundaries survive
  norm := regexp_replace(norm, '[^a-z ]', '', 'g');
  norm := ' ' || regexp_replace(norm, '\s+', ' ', 'g') || ' ';
  if norm ~ ' (fuck|fuk|fuc|shit|sht|bitch|btch|asshole|bastard|dick|piss|cunt|whore|slut|nigg[a-z]*|fag[a-z]*|douche|damn|goddamn|motherfucker|bullshit|jackass|cock|pussy|retard)[a-z]* ' then
    raise exception 'Message blocked: please keep the language clean.';
  end if;
  return new;
end; $$;

drop trigger if exists messages_profanity on messages;
create trigger messages_profanity before insert on messages
  for each row execute function check_profanity();

-- ── Realtime for channels so new chats appear live for the people added ──
do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'channels') then
    alter publication supabase_realtime add table channels;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'channel_members') then
    alter publication supabase_realtime add table channel_members;
  end if;
end $$;
