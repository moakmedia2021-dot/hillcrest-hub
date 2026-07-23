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
  Role,
  TaskStage,
} from "../types";
import { SEED } from "../seed";

// ── Read: load everything into AppData ───────────────────
export async function loadAll(sb: SupabaseClient): Promise<AppData> {
  const [profiles, channels, chanMembers, messages, tasks, events, eventTasks] =
    await Promise.all([
      sb.from("profiles").select("*").order("name"),
      sb.from("channels").select("*").order("created_at"),
      sb.from("channel_members").select("*"),
      sb.from("messages").select("*").order("created_at"),
      sb.from("tasks").select("*").order("created_at", { ascending: false }),
      sb.from("events").select("*").order("date"),
      sb.from("event_tasks").select("*").order("sort"),
    ]);

  const members: Member[] = (profiles.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role as Role,
    department: p.department ?? "Creative",
    title: p.title ?? undefined,
    email: p.email ?? "",
    phone: p.phone ?? undefined,
    avatarColor: p.avatar_color ?? "#12a6db",
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
    memberIds: c.everyone ? ["*"] : memberIdsByChannel.get(c.id) ?? [],
  }));

  const messageList: Message[] = (messages.data ?? []).map((m) => ({
    id: m.id,
    channelId: m.channel_id,
    authorId: m.author_id,
    body: m.body,
    pinned: m.pinned ?? false,
    createdAt: m.created_at,
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
    .subscribe();
  return () => {
    sb.removeChannel(channel);
  };
}

// ── Writes ───────────────────────────────────────────────
export const writes = {
  sendMessage: (sb: SupabaseClient, channelId: string, authorId: string, body: string) =>
    sb.from("messages").insert({ channel_id: channelId, author_id: authorId, body }),

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
};
