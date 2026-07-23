// ─────────────────────────────────────────────
// Core domain types for Hillcrest Hub
// ─────────────────────────────────────────────

export type Role = "admin" | "pastor" | "lead" | "volunteer";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  pastor: "Pastor",
  lead: "Team Lead",
  volunteer: "Volunteer",
};

// Permissions are derived from role. Keep this the single source of truth.
export type Permission =
  | "manage_users" // change roles, add/remove people
  | "post_announcement" // broadcast to everyone
  | "manage_schedule" // create/assign/delete production tasks
  | "manage_events" // create/plan events
  | "manage_channels" // create teams/departments
  | "view_admin"; // see the admin area

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    "manage_users",
    "post_announcement",
    "manage_schedule",
    "manage_events",
    "manage_channels",
    "view_admin",
  ],
  pastor: [
    "post_announcement",
    "manage_schedule",
    "manage_events",
    "manage_channels",
  ],
  lead: ["manage_schedule", "manage_events"],
  volunteer: [],
};

export function can(role: Role, perm: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(perm);
}

export interface Member {
  id: string;
  name: string;
  role: Role;
  department: string; // e.g. "Creative", "Worship", "Youth"
  title?: string; // e.g. "Videographer"
  email: string;
  phone?: string;
  avatarColor: string; // for the initials avatar (fallback)
  username?: string;
  avatarUrl?: string; // profile picture; falls back to initials avatar
  bio?: string;
  approved?: boolean; // false = pending admin approval
}

export type ResourceKind = "link" | "file" | "video" | "doc" | "note";

export interface Resource {
  id: string;
  title: string;
  description?: string;
  url?: string;
  kind: ResourceKind;
  department?: string; // undefined = everyone
  createdById?: string;
  createdAt: string;
}

export type ChannelKind = "announcement" | "team" | "department" | "direct";

export interface Channel {
  id: string;
  name: string;
  kind: ChannelKind;
  memberIds: string[]; // who can see it ("*" convention handled in store)
  description?: string;
  department?: string; // if set, everyone in this department can see it
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  body: string;
  imageUrl?: string; // attached image
  createdAt: string; // ISO
  pinned?: boolean;
  deleted?: boolean;
  deletedById?: string; // who deleted it
  originalBody?: string; // populated only for admins (the deleted content)
}

// Social-media / video production pipeline
export type TaskStage =
  | "idea"
  | "filming"
  | "editing"
  | "review"
  | "scheduled"
  | "posted";

export const STAGES: { id: TaskStage; label: string }[] = [
  { id: "idea", label: "Ideas" },
  { id: "filming", label: "Filming" },
  { id: "editing", label: "Editing" },
  { id: "review", label: "Review" },
  { id: "scheduled", label: "Scheduled" },
  { id: "posted", label: "Posted" },
];

export type Platform = "instagram" | "youtube" | "tiktok" | "facebook" | "web";

export interface ProductionTask {
  id: string;
  title: string;
  description?: string;
  stage: TaskStage;
  assigneeId?: string;
  dueDate?: string; // ISO date
  platform?: Platform;
  createdAt: string;
}

// ── Event planning ────────────────────────────
export type EventCategory =
  | "service"
  | "youth"
  | "outreach"
  | "production"
  | "special";

export const EVENT_CATEGORY: Record<
  EventCategory,
  { label: string; emoji: string }
> = {
  service: { label: "Service", emoji: "⛪" },
  youth: { label: "Youth", emoji: "🔥" },
  outreach: { label: "Outreach", emoji: "🤝" },
  production: { label: "Production", emoji: "🎬" },
  special: { label: "Special Event", emoji: "✨" },
};

// A reusable checklist item on a template. `offsetDays` is days BEFORE the
// event it should be done (0 = day of).
export interface TemplateItem {
  id: string;
  label: string;
  role?: Role; // suggested owner role
  offsetDays: number;
}

export interface EventTemplate {
  id: string;
  name: string;
  category: EventCategory;
  description?: string;
  items: TemplateItem[];
}

// A checklist item on a real event (instantiated from a template item).
export interface EventTask {
  id: string;
  label: string;
  done: boolean;
  assigneeId?: string;
  dueDate?: string; // ISO date
}

export interface ChurchEvent {
  id: string;
  title: string;
  category: EventCategory;
  date: string; // ISO date
  time?: string;
  location?: string;
  ownerId?: string;
  templateId?: string;
  notes?: string;
  tasks: EventTask[];
  createdAt: string;
}

export interface AppData {
  members: Member[];
  channels: Channel[];
  messages: Message[];
  tasks: ProductionTask[];
  templates: EventTemplate[];
  events: ChurchEvent[];
  resources: Resource[];
}
