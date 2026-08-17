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
  Organization,
  Availability,
  Rsvp,
  Kudos,
  RsvpStatus,
  Assignment,
  SubRequest,
  SubStatusKind,
  Meeting,
  Goal,
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
    availability,
    rsvps,
    kudos,
    orgs,
    assignments,
    subReqs,
    depts,
    meetings,
    agenda,
    actions,
    goals,
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
    sb.from("availability").select("*"),
    sb.from("event_rsvps").select("*"),
    sb.from("kudos").select("*").order("created_at", { ascending: false }),
    // RLS returns only the caller's church.
    sb.from("organizations").select("*").limit(1),
    sb.from("assignments").select("*").order("date"),
    sb.from("sub_requests").select("*").order("created_at", { ascending: false }),
    sb.from("departments").select("*").order("name"),
    sb.from("meetings").select("*").order("date", { ascending: false }),
    sb.from("agenda_items").select("*").order("sort"),
    sb.from("action_items").select("*").order("created_at"),
    sb.from("goals").select("*").order("created_at", { ascending: false }),
  ]);

  const orgRow = orgs.data?.[0];
  const org = orgRow
    ? {
        id: orgRow.id as string,
        name: orgRow.name as string,
        inviteCode: (orgRow.invite_code as string) ?? "",
        brandColor: (orgRow.brand_color as string) ?? undefined,
        logoUrl: (orgRow.logo_url as string) ?? undefined,
        plan: (orgRow.plan as Organization["plan"]) ?? undefined,
        status: (orgRow.status as Organization["status"]) ?? undefined,
        trialEndsAt: (orgRow.trial_ends_at as string) ?? undefined,
        // Older databases have no column yet — treat as already set up.
        setupComplete: (orgRow.setup_complete as boolean) ?? true,
      }
    : undefined;

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
    orgId: p.org_id ?? undefined,
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
    org,
    departments: (depts.data ?? []).map((d) => ({
      id: d.id as string,
      name: d.name as string,
    })),
    members,
    channels: channelList,
    messages: messageList,
    tasks: taskList,
    events: eventList,
    templates: SEED.templates, // static app constants
    resources: resourceList,
    availability: (availability.data ?? []).map(
      (a): Availability => ({ memberId: a.member_id, date: a.date })
    ),
    rsvps: (rsvps.data ?? []).map(
      (r): Rsvp => ({
        eventId: r.event_id,
        memberId: r.member_id,
        status: r.status as RsvpStatus,
      })
    ),
    kudos: (kudos.data ?? []).map(
      (k): Kudos => ({
        id: k.id,
        fromId: k.from_id ?? undefined,
        toId: k.to_id,
        message: k.message,
        createdAt: k.created_at,
      })
    ),
    assignments: (assignments.data ?? []).map(
      (a): Assignment => ({
        id: a.id,
        date: a.date,
        department: a.department,
        position: a.position,
        memberId: a.member_id ?? undefined,
        time: a.time ?? undefined,
        location: a.location ?? undefined,
        notes: a.notes ?? undefined,
        published: a.published ?? false,
      })
    ),
    meetings: (meetings.data ?? []).map((m) => ({
      id: m.id as string,
      kind: m.kind as Meeting["kind"],
      title: m.title as string,
      date: m.date as string,
      department: (m.department as string) ?? undefined,
      ownerId: (m.owner_id as string) ?? undefined,
      withId: (m.with_id as string) ?? undefined,
      notes: (m.notes as string) ?? undefined,
      createdAt: m.created_at as string,
    })),
    agendaItems: (agenda.data ?? []).map((a) => ({
      id: a.id as string,
      meetingId: a.meeting_id as string,
      text: a.text as string,
      addedById: (a.added_by as string) ?? undefined,
      discussed: (a.discussed as boolean) ?? false,
    })),
    actionItems: (actions.data ?? []).map((a) => ({
      id: a.id as string,
      meetingId: a.meeting_id as string,
      text: a.text as string,
      assigneeId: (a.assignee_id as string) ?? undefined,
      dueDate: (a.due_date as string) ?? undefined,
      done: (a.done as boolean) ?? false,
    })),
    goals: (goals.data ?? []).map((g) => ({
      id: g.id as string,
      memberId: g.member_id as string,
      text: g.text as string,
      status: g.status as Goal["status"],
    })),
    subRequests: (subReqs.data ?? []).map(
      (s): SubRequest => ({
        id: s.id,
        assignmentId: s.assignment_id,
        requestedById: s.requested_by ?? undefined,
        reason: s.reason ?? undefined,
        status: (s.status as SubStatusKind) ?? "open",
        filledById: s.filled_by ?? undefined,
        createdAt: s.created_at,
      })
    ),
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
    .on("postgres_changes", { event: "*", schema: "public", table: "availability" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "event_rsvps" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "kudos" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "assignments" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "sub_requests" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "agenda_items" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "action_items" }, onChange)
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

  setAvailability: (
    sb: SupabaseClient,
    memberId: string,
    date: string,
    on: boolean
  ) =>
    on
      ? sb.from("availability").upsert({ member_id: memberId, date })
      : sb
          .from("availability")
          .delete()
          .eq("member_id", memberId)
          .eq("date", date),

  setRsvp: (
    sb: SupabaseClient,
    eventId: string,
    memberId: string,
    status: string
  ) =>
    sb
      .from("event_rsvps")
      .upsert({ event_id: eventId, member_id: memberId, status }),

  giveKudos: (
    sb: SupabaseClient,
    fromId: string,
    toId: string,
    message: string
  ) => sb.from("kudos").insert({ from_id: fromId, to_id: toId, message }),

  renameOrg: (sb: SupabaseClient, orgId: string, name: string) =>
    sb.from("organizations").update({ name }).eq("id", orgId),

  addAssignment: (
    sb: SupabaseClient,
    a: Omit<Assignment, "id">
  ) =>
    sb.from("assignments").insert({
      date: a.date,
      department: a.department,
      position: a.position,
      member_id: a.memberId ?? null,
      time: a.time ?? null,
      location: a.location ?? null,
      notes: a.notes ?? null,
      published: a.published ?? false,
    }),

  setAssignmentMember: (
    sb: SupabaseClient,
    id: string,
    memberId: string | null
  ) => sb.from("assignments").update({ member_id: memberId }).eq("id", id),

  deleteAssignment: (sb: SupabaseClient, id: string) =>
    sb.from("assignments").delete().eq("id", id),

  publishRoster: (sb: SupabaseClient, date: string, department: string) =>
    sb
      .from("assignments")
      .update({ published: true })
      .eq("date", date)
      .eq("department", department),

  addDepartment: (sb: SupabaseClient, name: string) =>
    sb.from("departments").insert({ name }),

  deleteDepartment: (sb: SupabaseClient, id: string) =>
    sb.from("departments").delete().eq("id", id),

  // ── Meetings ──
  addMeeting: (
    sb: SupabaseClient,
    m: {
      kind: string;
      title: string;
      date: string;
      ownerId: string;
      withId?: string;
      department?: string;
    }
  ) =>
    sb.from("meetings").insert({
      kind: m.kind,
      title: m.title,
      date: m.date,
      owner_id: m.ownerId,
      with_id: m.withId ?? null,
      department: m.department ?? null,
    }),

  setMeetingNotes: (sb: SupabaseClient, id: string, notes: string) =>
    sb.from("meetings").update({ notes }).eq("id", id),

  deleteMeeting: (sb: SupabaseClient, id: string) =>
    sb.from("meetings").delete().eq("id", id),

  addAgendaItem: (
    sb: SupabaseClient,
    meetingId: string,
    text: string,
    addedBy: string
  ) =>
    sb
      .from("agenda_items")
      .insert({ meeting_id: meetingId, text, added_by: addedBy }),

  setAgendaDiscussed: (sb: SupabaseClient, id: string, discussed: boolean) =>
    sb.from("agenda_items").update({ discussed }).eq("id", id),

  deleteAgendaItem: (sb: SupabaseClient, id: string) =>
    sb.from("agenda_items").delete().eq("id", id),

  addActionItem: (
    sb: SupabaseClient,
    a: {
      meetingId: string;
      text: string;
      assigneeId?: string;
      dueDate?: string;
    }
  ) =>
    sb.from("action_items").insert({
      meeting_id: a.meetingId,
      text: a.text,
      assignee_id: a.assigneeId ?? null,
      due_date: a.dueDate ?? null,
    }),

  setActionDone: (sb: SupabaseClient, id: string, done: boolean) =>
    sb.from("action_items").update({ done }).eq("id", id),

  deleteActionItem: (sb: SupabaseClient, id: string) =>
    sb.from("action_items").delete().eq("id", id),

  addGoal: (sb: SupabaseClient, memberId: string, text: string) =>
    sb.from("goals").insert({ member_id: memberId, text }),

  setGoalStatus: (sb: SupabaseClient, id: string, status: string) =>
    sb.from("goals").update({ status }).eq("id", id),
};

// Turn a meeting action item into a real task on the production board.
export async function actionToTask(
  sb: SupabaseClient,
  itemId: string
): Promise<{ error?: string }> {
  const { error } = await sb.rpc("action_to_task", { item_id: itemId });
  return { error: error?.message };
}

// Private notes are readable only by their author (enforced by RLS).
export async function loadPrivateNote(
  sb: SupabaseClient,
  meetingId: string
): Promise<string> {
  const { data } = await sb
    .from("private_notes")
    .select("body")
    .eq("meeting_id", meetingId)
    .maybeSingle();
  return (data?.body as string) ?? "";
}

export async function savePrivateNote(
  sb: SupabaseClient,
  meetingId: string,
  authorId: string,
  body: string
): Promise<{ error?: string }> {
  const { error } = await sb
    .from("private_notes")
    .upsert(
      { meeting_id: meetingId, author_id: authorId, body, updated_at: new Date().toISOString() },
      { onConflict: "meeting_id,author_id" }
    );
  return { error: error?.message };
}

// ── First-run setup ──────────────────────────────────────
export async function completeSetup(
  sb: SupabaseClient,
  departments: string[]
): Promise<{ error?: string }> {
  const { error } = await sb.rpc("complete_setup", {
    dept_names: departments,
  });
  return { error: error?.message };
}

export async function skipSetup(
  sb: SupabaseClient
): Promise<{ error?: string }> {
  const { error } = await sb.rpc("skip_setup");
  return { error: error?.message };
}

// ── Sub / swap ───────────────────────────────────────────
export async function requestSub(
  sb: SupabaseClient,
  assignmentId: string,
  reason?: string
): Promise<{ error?: string }> {
  const { data, error } = await sb.rpc("request_sub", {
    assignment: assignmentId,
    why: reason ?? null,
  });
  if (error) return { error: error.message };
  // Tell the department — best effort, never blocks the request itself.
  const id = (data as { id?: string } | null)?.id;
  if (id) {
    try {
      await sb.rpc("notify_sub_request", { req_id: id });
    } catch {
      /* notifying is best effort */
    }
  }
  return {};
}

// Queue "you're serving" reminders for everyone on a published roster.
export async function notifyRoster(
  sb: SupabaseClient,
  date: string,
  department: string
): Promise<{ error?: string }> {
  const { error } = await sb.rpc("notify_roster", {
    the_date: date,
    dept: department,
  });
  return { error: error?.message };
}

export async function acceptSubRequest(
  sb: SupabaseClient,
  reqId: string
): Promise<{ error?: string }> {
  const { error } = await sb.rpc("accept_sub_request", { req_id: reqId });
  return { error: error?.message };
}

export async function cancelSubRequest(
  sb: SupabaseClient,
  reqId: string
): Promise<{ error?: string }> {
  const { error } = await sb.rpc("cancel_sub_request", { req_id: reqId });
  return { error: error?.message };
}

// ── Starting or joining a church ─────────────────────────
export async function createOrganization(
  sb: SupabaseClient,
  name: string,
  plan: string = "starter"
): Promise<{ error?: string }> {
  const { error } = await sb.rpc("create_organization", {
    org_name: name,
    plan_name: plan,
  });
  return { error: error?.message };
}

// TEST MODE: marks the subscription active without taking payment.
// A real Stripe checkout webhook replaces this call.
export async function activateSubscriptionTest(
  sb: SupabaseClient,
  plan: string
): Promise<{ error?: string }> {
  const { error } = await sb.rpc("activate_subscription_test", {
    plan_name: plan,
  });
  return { error: error?.message };
}

// ── Platform admin (internal) ────────────────────────────
export interface PlatformOrg {
  id: string;
  name: string;
  invite_code: string;
  plan: string;
  status: string;
  trial_ends_at: string | null;
  created_at: string;
  members: number;
  pending: number;
  messages: number;
  events: number;
  tasks: number;
}

export interface PlatformOverview {
  orgs: PlatformOrg[];
  totals: {
    churches: number;
    members: number;
    active: number;
    trialing: number;
  };
}

export async function platformOverview(
  sb: SupabaseClient
): Promise<{ data?: PlatformOverview; error?: string }> {
  const { data, error } = await sb.rpc("platform_overview");
  return { data: data as PlatformOverview | undefined, error: error?.message };
}

export async function platformSetOrgStatus(
  sb: SupabaseClient,
  orgId: string,
  status: string
): Promise<{ error?: string }> {
  const { error } = await sb.rpc("platform_set_org_status", {
    target_org: orgId,
    new_status: status,
  });
  return { error: error?.message };
}

export async function joinOrganization(
  sb: SupabaseClient,
  code: string
): Promise<{ error?: string }> {
  const { error } = await sb.rpc("join_organization", { code });
  return { error: error?.message };
}

export async function regenerateInviteCode(
  sb: SupabaseClient
): Promise<{ code?: string; error?: string }> {
  const { data, error } = await sb.rpc("regenerate_invite_code");
  return { code: data as string | undefined, error: error?.message };
}

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
