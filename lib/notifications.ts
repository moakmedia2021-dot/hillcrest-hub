import type { AppData, Member } from "./types";
import { dueMeta } from "./format";

export interface Notif {
  id: string;
  icon: "task" | "event" | "chat" | "serving";
  text: string;
  href: string;
  urgent?: boolean;
}

// Reminders derived from current data — no server needed. Shown in the bell.
export function buildNotifications(
  data: AppData,
  user: Member,
  lastRead: Record<string, string>
): Notif[] {
  const out: Notif[] = [];

  // My production tasks due soon / overdue
  for (const t of data.tasks) {
    if (t.assigneeId !== user.id || t.stage === "posted" || !t.dueDate) continue;
    const meta = dueMeta(t.dueDate);
    if (meta.tone === "danger" || meta.tone === "warn") {
      out.push({
        id: "t" + t.id,
        icon: "task",
        text: `${t.title} — ${meta.label.toLowerCase()}`,
        href: "/schedule",
        urgent: meta.tone === "danger",
      });
    }
  }

  // Upcoming events I own or have an open checklist item in (within a week)
  const now = Date.now();
  for (const e of data.events) {
    const days = Math.round((new Date(e.date).getTime() - now) / 86400000);
    if (days < 0 || days > 7) continue;
    const mine =
      e.ownerId === user.id ||
      e.tasks.some((t) => t.assigneeId === user.id && !t.done);
    if (mine)
      out.push({
        id: "e" + e.id,
        icon: "event",
        text: `${e.title} — ${
          days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`
        }`,
        href: `/events/${e.id}`,
        urgent: days <= 1,
      });
  }

  // Serving: my next assignment within a week
  const todayIso = new Date().toISOString().slice(0, 10);
  for (const a of data.assignments) {
    if (a.memberId !== user.id || a.date < todayIso) continue;
    const days = Math.round(
      (new Date(a.date + "T12:00:00").getTime() -
        new Date(todayIso + "T12:00:00").getTime()) /
        86400000
    );
    if (days > 7) continue;
    out.push({
      id: "s" + a.id,
      icon: "serving",
      text: `You're serving ${a.position} — ${
        days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`
      }`,
      href: "/my-sunday",
      urgent: days <= 1,
    });
  }

  // Serving: open sub requests my department could cover
  for (const s of data.subRequests) {
    if (s.status !== "open") continue;
    const a = data.assignments.find((x) => x.id === s.assignmentId);
    if (!a || a.date < todayIso || a.memberId === user.id) continue;
    if (a.department !== user.department && user.role !== "admin") continue;
    out.push({
      id: "sr" + s.id,
      icon: "serving",
      text: `${a.position} needs cover on ${new Date(
        a.date + "T12:00:00"
      ).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
      href: "/my-sunday",
    });
  }

  // Unread chats
  const myChannels = data.channels.filter(
    (c) =>
      c.memberIds.includes("*") ||
      c.memberIds.includes(user.id) ||
      (c.department != null && c.department === user.department) ||
      user.role === "admin"
  );
  for (const c of myChannels) {
    const since = lastRead[c.id];
    const unread = data.messages.filter(
      (m) =>
        m.channelId === c.id &&
        m.authorId !== user.id &&
        !m.deleted &&
        (!since || m.createdAt > since)
    ).length;
    if (unread > 0)
      out.push({
        id: "c" + c.id,
        icon: "chat",
        text: `${unread} new message${unread > 1 ? "s" : ""} in ${c.name}`,
        href: "/chat",
      });
  }

  return out;
}
