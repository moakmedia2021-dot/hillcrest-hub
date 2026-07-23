// ─────────────────────────────────────────────
// Supabase data access. Used by the store ONLY when Supabase is configured.
// Maps snake_case DB rows <-> the camelCase app types in lib/types.ts.
//
// Templates stay as static app constants (they're app-defined, not user data),
// so this module covers members, channels, messages, tasks, and events.
// ─────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AppData,
  Member,
  Channel,
  Message,
  ProductionTask,
  ChurchEvent,
  Resource,
  Role,
  TaskStage,
  ResourceKind,
} from "../types";
import { SEED } from "../seed";

// ── Read: load everything into AppData ───────────────────
export async function loadAll(sb: SupabaseClient): Promise<AppData> {
  const [
    profiles,
    channels,
    chanMembers,
    messages,
    tasks,
    events,
    eventTasks,
    deletions,
    resources,
  ] = await Promise.all([
    sb.from("profiles").select("*").order("name"),
    sb.from("channels").select("*").order("created_at"),
    sb.from("channel_members").select("*"),
    sb.from("messages").select("*").order("created_at"),
    sb.from("tasks").select("*").order("created_at", { ascending: false }),
    sb.from("events").select("*").order("date"),
    sb.from("event_tasks").select("*").order("sort"),
    // Only admins get rows back (RLS); non-admins/older DBs get none.
    sb.from("message_deletions").select("message_id, original_body"),
    sb.from("resources").select("*").order("created_at", { ascending: false }),
  ]);

  // message_id -> original deleted content (admins only)
  const deletedBodies = new Map<string, string>();
  for (const d of deletions.data ?? [])
    deletedBodies.set(d.message_id as string, d.original_body as string);

  const members: Member[] = (profiles.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role as Role,
    department: p.department ?? "Creative",
    title: p.title ?? undefined,
    email: p.email ?? "",
    phone: p.phone ?? undefined,
    avatarColor: p.avatar_color ?? "#12a6db",
    username: p.username ?? undefined,
    avatarUrl: p.avatar_url ?? undefined,
    bio: p.bio ?? undefined,
    approved: p.approved ?? true, // pre-migration rows have no column → allow
  }));

  const resourceList: Resource[] = (resources.data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description ?? undefined,
    url: r.url ?? undefined,
    kind: (r.kind as ResourceKind) ?? "link",
    department: r.department ?? undefined,
    createdById: r.created_by ?? undefined,
    createdAt: r.created_at,
  }));

  const memberIdsByChannel = new Map<string, string[]>();
  for (const cm of chanMembers.data ?? []) {
    const arr = memberIdsByChannel.get(cm.channel_id) ?? [];
    arr.push(cm.member_id);
    memberIdsByChannel.set(cm.channel_id, arr);
  }

  const channelList: Channel[] = (channels.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    description: c.description ?? undefined,
    department: c.department ?? undefined,
    memberIds: c.everyone ? ["*"] : memberIdsByChannel.get(c.id) ?? [],
  }));

  const messageList: Message[] = (messages.data ?? []).map((m) => ({
    id: m.id,
    channelId: m.channel_id,
    authorId: m.author_id,
    body: m.body,
    imageUrl: m.image_url ?? undefined,
    pinned: m.pinned ?? false,
    createdAt: m.created_at,
    deleted: m.deleted ?? false,
    deletedById: m.deleted_by ?? undefined,
    originalBody: deletedBodies.get(m.id) ?? undefined,
  }));

  const taskList: ProductionTask[] = (tasks.data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description ?? undefined,
    stage: t.stage as TaskStage,
    assigneeId: t.assignee_id ?? undefined,
    dueDate: t.due_date ?? undefined,
    platform: t.platform ?? undefined,
    createdAt: t.created_at,
  }));

  const eventList: ChurchEvent[] = (events.data ?? []).map((e) => ({
    id: e.id,
    title: e.title,
    category: e.category,
    date: e.date,
    time: e.time ?? undefined,
    location: e.location ?? undefined,
    ownerId: e.owner_id ?? undefined,
    templateId: e.template_id ?? undefined,
    notes: e.notes ?? undefined,
    createdAt: e.created_at,
    tasks: (eventTasks.data ?? [])
      .filter((et) => et.event_id === e.id)
      .map((et) => ({
        id: et.id,
        label: et.label,
        done: et.done,
        assigneeId: et.assignee_id ?? undefined,
        dueDate: et.due_date ?? undefined,
      })),
  }));

  return {
    members,
    channels: channelList,
    messages: messageList,
    tasks: taskList,
    events: eventList,
    templates: SEED.templates, // static app constants
    resources: resourceList,
  };
}

// ── Realtime: re-load on any change to the live tables ───
export function subscribe(sb: SupabaseClient, onChange: () => void) {
  const channel = sb
    .channel("hub-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "events" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "event_tasks" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "channels" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "channel_members" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "resources" }, onChange)
    .subscribe();
  return () => {
    sb.removeChannel(channel);
  };
}

// ── Writes ───────────────────────────────────────────────
export const writes = {
  sendMessage: (
    sb: SupabaseClient,
    channelId: string,
    authorId: string,
    body: string,
    imageUrl?: string
  ) =>
    sb.from("messages").insert({
      channel_id: channelId,
      author_id: authorId,
      body,
      image_url: imageUrl ?? null,
    }),

  createChannel: async (
    sb: SupabaseClient,
    input: {
      name: string;
      kind: string;
      memberIds: string[];
      department?: string;
    }
  ): Promise<{ id?: string; error?: string }> => {
    const { data, error } = await sb
      .from("channels")
      .insert({
        name: input.name,
        kind: input.kind,
        everyone: false,
        department: input.department ?? null,
      })
      .select("id")
      .single();
    if (error || !data) return { error: error?.message ?? "create failed" };
    if (input.memberIds.length) {
      await sb
        .from("channel_members")
        .insert(input.memberIds.map((m) => ({ channel_id: data.id, member_id: m })));
    }
    return { id: data.id };
  },

  clearChannel: (sb: SupabaseClient, cid: string) =>
    sb.rpc("clear_channel", { cid }),

  addChannelMember: (sb: SupabaseClient, cid: string, memberId: string) =>
    sb
      .from("channel_members")
      .upsert({ channel_id: cid, member_id: memberId }),

  removeChannelMember: (sb: SupabaseClient, cid: string, memberId: string) =>
    sb
      .from("channel_members")
      .delete()
      .eq("channel_id", cid)
      .eq("member_id", memberId),

  approveMember: (sb: SupabaseClient, id: string, approved: boolean) =>
    sb.from("profiles").update({ approved }).eq("id", id),

  addResource: (
    sb: SupabaseClient,
    r: {
      title: string;
      description?: string;
      url?: string;
      kind: string;
      department?: string;
      createdById?: string;
    }
  ) =>
    sb.from("resources").insert({
      title: r.title,
      description: r.description ?? null,
      url: r.url ?? null,
      kind: r.kind,
      department: r.department ?? null,
      created_by: r.createdById ?? null,
    }),

  deleteResource: (sb: SupabaseClient, id: string) =>
    sb.from("resources").delete().eq("id", id),

  addTask: (
    sb: SupabaseClient,
    t: Omit<ProductionTask, "id" | "createdAt">
  ) =>
    sb.from("tasks").insert({
      title: t.title,
      description: t.description,
      stage: t.stage,
      assignee_id: t.assigneeId,
      due_date: t.dueDate,
      platform: t.platform,
    }),

  moveTask: (sb: SupabaseClient, id: string, stage: TaskStage) =>
    sb.from("tasks").update({ stage }).eq("id", id),

  deleteTask: (sb: SupabaseClient, id: string) =>
    sb.from("tasks").delete().eq("id", id),

  setMemberRole: (sb: SupabaseClient, id: string, role: Role) =>
    sb.from("profiles").update({ role }).eq("id", id),

  createEvent: async (
    sb: SupabaseClient,
    e: Omit<ChurchEvent, "createdAt">
  ) => {
    await sb.from("events").insert({
      id: e.id,
      title: e.title,
      category: e.category,
      date: e.date,
      time: e.time,
      location: e.location,
      owner_id: e.ownerId,
      template_id: e.templateId,
      notes: e.notes,
    });
    if (e.tasks.length) {
      await sb.from("event_tasks").insert(
        e.tasks.map((t, i) => ({
          event_id: e.id,
          label: t.label,
          done: t.done,
          assignee_id: t.assigneeId,
          due_date: t.dueDate,
          sort: i,
        }))
      );
    }
  },

  deleteEvent: (sb: SupabaseClient, id: string) =>
    sb.from("events").delete().eq("id", id),

  toggleEventTask: (sb: SupabaseClient, taskId: string, done: boolean) =>
    sb.from("event_tasks").update({ done }).eq("id", taskId),

  assignEventTask: (sb: SupabaseClient, taskId: string, assigneeId: string) =>
    sb.from("event_tasks").update({ assignee_id: assigneeId }).eq("id", taskId),

  deleteMessage: (sb: SupabaseClient, msgId: string) =>
    sb.rpc("delete_message", { msg_id: msgId }),

  updateProfile: (
    sb: SupabaseClient,
    id: string,
    patch: {
      name?: string;
      username?: string;
      title?: string;
      department?: string;
      phone?: string;
      bio?: string;
      avatar_url?: string;
    }
  ) => sb.from("profiles").update(patch).eq("id", id),
};

// Upload an avatar image to Storage and return its public URL.
export async function uploadAvatar(
  sb: SupabaseClient,
  userId: string,
  file: File
): Promise<{ url?: string; error?: string }> {
  const ext = file.name.split(".").pop() || "png";
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const up = await sb.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (up.error) return { error: up.error.message };
  const { data } = sb.storage.from("avatars").getPublicUrl(path);
  return { url: data.publicUrl };
}

// Chat images share the (public) avatars bucket under a chat/ prefix, so no
// extra bucket setup is needed.
export async function uploadChatImage(
  sb: SupabaseClient,
  userId: string,
  file: File
): Promise<{ url?: string; error?: string }> {
  const ext = file.name.split(".").pop() || "png";
  const path = `chat/${userId}/${Date.now()}.${ext}`;
  const up = await sb.storage
    .from("avatars")
    .upload(path, file, { contentType: file.type });
  if (up.error) return { error: up.error.message };
  const { data } = sb.storage.from("avatars").getPublicUrl(path);
  return { url: data.publicUrl };
}
