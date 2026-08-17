"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { STAGES } from "@/lib/types";
import { relativeTime, dueMeta } from "@/lib/format";
import {
  Megaphone,
  KanbanSquare,
  Clock3,
  CheckCircle2,
  ArrowRight,
  Pin,
} from "lucide-react";

const toneClass = {
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
  muted: "text-ink-soft",
} as const;

export default function DashboardPage() {
  const { user, can } = useAuth();
  const { data } = useStore();
  if (!user) return null;

  // Volunteers get a focused "here's your week" view instead of the
  // leadership dashboard.
  if (!can("manage_schedule") && !can("view_staff"))
    return <VolunteerDashboard />;

  const myTasks = data.tasks.filter(
    (t) => t.assigneeId === user.id && t.stage !== "posted"
  );
  const openTasks = data.tasks.filter((t) => t.stage !== "posted");
  const postedThisSet = data.tasks.filter((t) => t.stage === "posted");
  const pinned = data.messages.find((m) => m.pinned);
  const pinnedAuthor = data.members.find((m) => m.id === pinned?.authorId);

  const upcoming = [...data.tasks]
    .filter((t) => t.dueDate && t.stage !== "posted")
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
    .slice(0, 5);

  const recent = [...data.messages]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 5);

  const stats = [
    { label: "Open tasks", value: openTasks.length, icon: KanbanSquare, href: "/schedule" },
    { label: "Assigned to me", value: myTasks.length, icon: Clock3, href: "/schedule" },
    { label: "Posted", value: postedThisSet.length, icon: CheckCircle2, href: "/schedule" },
    { label: "Team members", value: data.members.length, icon: Megaphone, href: "/team" },
  ];

  return (
    <>
      <PageHeader
        eyebrow={`${greeting()}, ${user.name.split(" ")[0]}`}
        title="Dashboard"
        subtitle="Everything your team is working on, at a glance."
      />

      <div className="space-y-6 p-5 sm:p-8">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="card group p-4 transition hover:border-brand hover:shadow-sm"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand-dark">
                <s.icon size={18} />
              </div>
              <div className="text-2xl font-bold text-ink">{s.value}</div>
              <div className="text-xs text-ink-soft">{s.label}</div>
            </Link>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: announcement + my tasks */}
          <div className="space-y-6 lg:col-span-2">
            {pinned && (
              <div className="card overflow-hidden">
                <div className="flex items-center gap-2 border-b border-line bg-brand-soft/50 px-5 py-3">
                  <Pin size={14} className="text-brand-dark" />
                  <span className="text-xs font-bold uppercase tracking-wide text-brand-dark">
                    Pinned announcement
                  </span>
                </div>
                <div className="flex gap-3 p-5">
                  {pinnedAuthor && <Avatar member={pinnedAuthor} size={40} />}
                  <div>
                    <div className="text-sm font-semibold text-ink">
                      {pinnedAuthor?.name}{" "}
                      <span className="font-normal text-ink-soft">
                        · {relativeTime(pinned.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-ink">
                      {pinned.body}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="card">
              <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
                <h2 className="font-bold text-ink">My tasks</h2>
                <Link
                  href="/schedule"
                  className="flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-dark"
                >
                  Open board <ArrowRight size={13} />
                </Link>
              </div>
              {myTasks.length === 0 ? (
                <p className="p-5 text-sm text-ink-soft">
                  You&apos;re all caught up. 🎉
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {myTasks.map((t) => {
                    const stage = STAGES.find((s) => s.id === t.stage);
                    const due = dueMeta(t.dueDate);
                    return (
                      <li
                        key={t.id}
                        className="flex items-center gap-3 px-5 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-ink">
                            {t.title}
                          </div>
                          <div className="text-xs text-ink-soft">
                            {stage?.label}
                          </div>
                        </div>
                        <span
                          className={`text-xs font-semibold ${toneClass[due.tone]}`}
                        >
                          {due.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Right: upcoming + activity */}
          <div className="space-y-6">
            <div className="card">
              <div className="border-b border-line px-5 py-3.5">
                <h2 className="font-bold text-ink">Upcoming deadlines</h2>
              </div>
              <ul className="divide-y divide-line">
                {upcoming.map((t) => {
                  const due = dueMeta(t.dueDate);
                  const who = data.members.find((m) => m.id === t.assigneeId);
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                      {who && <Avatar member={who} size={28} />}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-ink">
                          {t.title}
                        </div>
                        <div
                          className={`text-xs font-semibold ${toneClass[due.tone]}`}
                        >
                          {due.label}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="card">
              <div className="border-b border-line px-5 py-3.5">
                <h2 className="font-bold text-ink">Recent activity</h2>
              </div>
              <ul className="divide-y divide-line">
                {recent.map((m) => {
                  const who = data.members.find((x) => x.id === m.authorId);
                  const ch = data.channels.find((c) => c.id === m.channelId);
                  return (
                    <li key={m.id} className="flex gap-3 px-5 py-3">
                      {who && <Avatar member={who} size={28} />}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-ink-soft">
                          <span className="font-semibold text-ink">
                            {who?.name.split(" ")[0]}
                          </span>{" "}
                          in {ch?.name} · {relativeTime(m.createdAt)}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-sm text-ink">
                          {m.body}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// What a volunteer actually needs week to week: when am I serving, what's
// happening, and anything my team needs from me.
function VolunteerDashboard() {
  const { user } = useAuth();
  const { data } = useStore();
  if (!user) return null;

  const today = new Date().toISOString().slice(0, 10);
  const mine = data.assignments
    .filter((a) => a.memberId === user.id && a.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const next = mine[0];

  const openSubs = data.subRequests.filter((s) => {
    if (s.status !== "open") return false;
    const a = data.assignments.find((x) => x.id === s.assignmentId);
    return a && a.date >= today && a.department === user.department;
  }).length;

  const announcements = data.messages
    .filter((m) => {
      const c = data.channels.find((x) => x.id === m.channelId);
      return c?.kind === "announcement" && !m.deleted;
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 3);

  const upcomingEvents = data.events
    .filter((e) => e.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 3);

  const myKudos = data.kudos.filter((k) => k.toId === user.id).length;

  return (
    <>
      <PageHeader
        eyebrow={`${greeting()}, ${user.name.split(" ")[0]}`}
        title="My Dashboard"
        subtitle="Your week at Hillcrest, at a glance."
      />

      <div className="space-y-6 p-4 sm:p-8">
        {/* Next serving */}
        {next ? (
          <Link
            href="/my-sunday"
            className="card group block overflow-hidden transition hover:border-brand"
          >
            <div className="flex items-center justify-between bg-brand px-5 py-2.5 text-white">
              <span className="text-sm font-bold">You&apos;re serving next</span>
              <ArrowRight
                size={16}
                className="transition group-hover:translate-x-0.5"
              />
            </div>
            <div className="p-5">
              <div className="text-xl font-bold text-ink">{next.position}</div>
              <div className="text-sm text-ink-soft">
                {new Date(next.date + "T12:00:00").toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
                {next.time ? ` · ${next.time}` : ""}
                {next.location ? ` · ${next.location}` : ""}
              </div>
            </div>
          </Link>
        ) : (
          <Link href="/serving" className="card block p-6 text-center hover:border-brand">
            <p className="font-bold text-ink">You&apos;re not scheduled yet</p>
            <p className="mt-1 text-sm text-ink-soft">
              Tap here to mark the Sundays you can serve.
            </p>
          </Link>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3">
          <Link href="/my-sunday" className="card p-4 text-center hover:border-brand">
            <div className="text-2xl font-bold text-ink">{mine.length}</div>
            <div className="text-xs text-ink-soft">Upcoming shifts</div>
          </Link>
          <Link href="/my-sunday" className="card p-4 text-center hover:border-brand">
            <div className="text-2xl font-bold text-ink">{openSubs}</div>
            <div className="text-xs text-ink-soft">Need cover</div>
          </Link>
          <Link href="/kudos" className="card p-4 text-center hover:border-brand">
            <div className="text-2xl font-bold text-ink">{myKudos}</div>
            <div className="text-xs text-ink-soft">Kudos received</div>
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Announcements */}
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="font-bold text-ink">Announcements</h2>
              <Link
                href="/chat"
                className="text-xs font-semibold text-brand hover:text-brand-dark"
              >
                Open chat
              </Link>
            </div>
            {announcements.length === 0 ? (
              <p className="p-5 text-sm text-ink-soft">Nothing new right now.</p>
            ) : (
              <ul className="divide-y divide-line">
                {announcements.map((m) => {
                  const who = data.members.find((x) => x.id === m.authorId);
                  return (
                    <li key={m.id} className="flex gap-3 px-5 py-3">
                      {who && <Avatar member={who} size={28} />}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-ink-soft">
                          <span className="font-semibold text-ink">
                            {who?.name.split(" ")[0]}
                          </span>{" "}
                          · {relativeTime(m.createdAt)}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-sm text-ink">
                          {m.body}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* What's coming */}
          <section className="card overflow-hidden">
            <div className="border-b border-line px-5 py-3.5">
              <h2 className="font-bold text-ink">What&apos;s coming up</h2>
            </div>
            {upcomingEvents.length === 0 ? (
              <p className="p-5 text-sm text-ink-soft">Nothing scheduled.</p>
            ) : (
              <ul className="divide-y divide-line">
                {upcomingEvents.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/events/${e.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-ink">
                          {e.title}
                        </div>
                        <div className="text-xs text-ink-soft">
                          {new Date(e.date + "T12:00:00").toLocaleDateString(
                            undefined,
                            { weekday: "short", month: "short", day: "numeric" }
                          )}
                          {e.time ? ` · ${e.time}` : ""}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
