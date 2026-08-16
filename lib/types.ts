// ─────────────────────────────────────────────
// Core domain types for Hillcrest Hub
// ─────────────────────────────────────────────

// A church. Every piece of data belongs to exactly one, and the database
// enforces that one church can never read another's.
export type PlanId = "starter" | "growth" | "multisite";
export type SubStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "suspended";

export const PLANS: {
  id: PlanId;
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
}[] = [
  {
    id: "starter",
    name: "Starter",
    price: "$0",
    cadence: "free while in beta",
    blurb: "Small churches and single teams.",
    features: [
      "Up to 25 members",
      "Chat, schedule, events, calendar",
      "Serving availability & rosters",
      "Department resources",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    price: "$29",
    cadence: "per month",
    blurb: "Growing churches with multiple ministries.",
    features: [
      "Unlimited members",
      "Everything in Starter",
      "Leadership analytics",
      "Planning Center integration",
      "Priority support",
    ],
  },
  {
    id: "multisite",
    name: "Multisite",
    price: "$79",
    cadence: "per month",
    blurb: "Large and multi-campus churches.",
    features: [
      "Everything in Growth",
      "Multiple campuses",
      "Delegated admin per campus",
      "Advanced reporting",
      "Onboarding help",
    ],
  },
];

export interface Organization {
  id: string;
  name: string;
  inviteCode: string;
  brandColor?: string;
  logoUrl?: string;
  plan?: PlanId;
  status?: SubStatus;
  trialEndsAt?: string;
}

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
  orgId?: string; // which church they belong to
  platformAdmin?: boolean; // runs the platform itself — granted via SQL only
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

export interface Availability {
  memberId: string;
  date: string; // ISO date I can serve
}

export type RsvpStatus = "going" | "maybe" | "no";

export interface Rsvp {
  eventId: string;
  memberId: string;
  status: RsvpStatus;
}

export interface Kudos {
  id: string;
  fromId?: string;
  toId: string;
  message: string;
  createdAt: string;
}

// One serving position on one date — the unit a roster is built from.
export interface Assignment {
  id: string;
  date: string;
  department: string;
  position: string;
  memberId?: string; // undefined = open slot
  time?: string;
  location?: string;
  notes?: string;
  published?: boolean;
}

export type SubStatusKind = "open" | "filled" | "cancelled";

export interface SubRequest {
  id: string;
  assignmentId: string;
  requestedById?: string;
  reason?: string;
  status: SubStatusKind;
  filledById?: string;
  createdAt: string;
}

// Common starting positions, offered when a lead builds a roster.
export const POSITION_SUGGESTIONS: Record<string, string[]> = {
  Creative: ["Camera 1", "Camera 2", "Livestream", "Photos", "Social"],
  Worship: ["Worship Lead", "Keys", "Acoustic", "Bass", "Drums", "Vocals"],
  Kids: ["Check-in", "Elementary Teacher", "Preschool", "Helper"],
  Youth: ["Youth Lead", "Small Group", "Games", "Snacks"],
  Hospitality: ["Greeter", "Coffee", "Usher", "Info Desk"],
  Security: ["Lobby", "Parking", "Kids Wing"],
};

export interface AppData {
  org?: Organization; // the signed-in user's church
  members: Member[];
  channels: Channel[];
  messages: Message[];
  tasks: ProductionTask[];
  templates: EventTemplate[];
  events: ChurchEvent[];
  resources: Resource[];
  availability: Availability[];
  rsvps: Rsvp[];
  kudos: Kudos[];
  assignments: Assignment[];
  subRequests: SubRequest[];
}
