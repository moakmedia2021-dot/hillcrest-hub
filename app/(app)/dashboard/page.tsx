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
  const { user } = useAuth();
  const { data } = useStore();
  if (!user) return null;

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
