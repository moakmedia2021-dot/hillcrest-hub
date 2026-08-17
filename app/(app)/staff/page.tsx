"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Avatar, RoleBadge } from "@/components/Avatar";
import { relativeTime, dueMeta } from "@/lib/format";
import {
  NotebookPen,
  BarChart3,
  BookOpen,
  CalendarRange,
  ClipboardList,
  Users,
  ArrowRight,
  Briefcase,
  ShieldCheck,
} from "lucide-react";

// The staff-only workspace. Everything a paid staff member needs in one place.
export default function StaffPage() {
  const { data } = useStore();
  const { user, can } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !can("view_staff")) router.replace("/dashboard");
  }, [user, can, router]);
  if (!user || !can("view_staff")) return null;

  const today = new Date().toISOString().slice(0, 10);

  const staff = data.members.filter(
    (m) => !m.removed && (m.isStaff || m.role === "admin" || m.role === "pastor")
  );
  const upcomingMeetings = data.meetings
    .filter((m) => m.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 4);
  const myActions = data.actionItems.filter(
    (a) => a.assigneeId === user.id && !a.done
  );
  const upcomingEvents = data.events
    .filter((e) => e.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 4);
  const staffResources = data.resources.filter((r) => r.staffOnly);
  const openRosterSlots = data.assignments.filter(
    (a) => a.date >= today && !a.memberId
  ).length;

  const tools = [
    {
      href: "/meetings",
      label: "Meetings & 1-on-1s",
      desc: "Agendas, notes, action items",
      icon: NotebookPen,
    },
    {
      href: "/roster",
      label: "Roster Builder",
      desc: "Schedule and publish serving",
      icon: ClipboardList,
    },
    {
      href: "/events",
      label: "Event Planning",
      desc: "Templates and checklists",
      icon: CalendarRange,
    },
    {
      href: "/analytics",
      label: "Analytics",
      desc: "Output, engagement, activity",
      icon: BarChart3,
    },
    {
      href: "/resources",
      label: "Resources",
      desc: "Guides and staff documents",
      icon: BookOpen,
    },
    {
      href: "/team",
      label: "Team Directory",
      desc: "Everyone across the church",
      icon: Users,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Staff"
        title="Staff Hub"
        subtitle="Church operations, meetings, and everything the staff team runs."
      />

      <div className="space-y-6 p-4 sm:p-8">
        {/* Quick numbers */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Staff members", value: staff.length, icon: Briefcase },
            { label: "My action items", value: myActions.length, icon: NotebookPen },
            { label: "Open roster spots", value: openRosterSlots, icon: ClipboardList },
            { label: "Upcoming events", value: upcomingEvents.length, icon: CalendarRange },
          ].map((s) => (
            <div key={s.label} className="card p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand-dark">
                <s.icon size={18} />
              </div>
              <div className="text-2xl font-bold text-ink">{s.value}</div>
              <div className="text-xs text-ink-soft">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Staff tools */}
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
            Staff tools
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="card group flex items-center gap-3 p-4 transition hover:border-brand hover:shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-dark">
                  <t.icon size={19} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-ink">{t.label}</div>
                  <div className="truncate text-xs text-ink-soft">{t.desc}</div>
                </div>
                <ArrowRight
                  size={16}
                  className="shrink-0 text-ink-soft/40 transition group-hover:translate-x-0.5 group-hover:text-brand"
                />
              </Link>
            ))}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* My action items */}
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="font-bold text-ink">My action items</h2>
              <Link
                href="/meetings"
                className="text-xs font-semibold text-brand hover:text-brand-dark"
              >
                Meetings
              </Link>
            </div>
            {myActions.length === 0 ? (
              <p className="p-5 text-sm text-ink-soft">
                Nothing assigned to you. 🎉
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {myActions.slice(0, 6).map((a) => {
                  const due = dueMeta(a.dueDate);
                  return (
                    <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="min-w-0 flex-1 text-sm text-ink">
                        {a.text}
                      </span>
                      {a.dueDate && (
                        <span className="shrink-0 text-xs font-semibold text-ink-soft">
                          {due.label}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Upcoming meetings */}
          <section className="card overflow-hidden">
            <div className="border-b border-line px-5 py-3.5">
              <h2 className="font-bold text-ink">Upcoming meetings</h2>
            </div>
            {upcomingMeetings.length === 0 ? (
              <p className="p-5 text-sm text-ink-soft">Nothing scheduled.</p>
            ) : (
              <ul className="divide-y divide-line">
                {upcomingMeetings.map((m) => (
                  <li key={m.id}>
                    <Link
                      href="/meetings"
                      className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-ink">
                          {m.title}
                        </div>
                        <div className="text-xs text-ink-soft">
                          {new Date(m.date + "T12:00:00").toLocaleDateString(
                            undefined,
                            { weekday: "short", month: "short", day: "numeric" }
                          )}
                          {m.kind === "one_on_one" ? " · 1-on-1" : ""}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Staff-only resources */}
        {staffResources.length > 0 && (
          <section className="card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
              <ShieldCheck size={16} className="text-brand" />
              <h2 className="font-bold text-ink">Staff documents</h2>
              <span className="ml-auto text-xs text-ink-soft">
                Not visible to volunteers
              </span>
            </div>
            <ul className="divide-y divide-line">
              {staffResources.map((r) => (
                <li key={r.id}>
                  <a
                    href={r.url ?? "#"}
                    target={r.url ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">
                        {r.title}
                      </div>
                      {r.description && (
                        <div className="truncate text-xs text-ink-soft">
                          {r.description}
                        </div>
                      )}
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Staff team */}
        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="font-bold text-ink">Staff team</h2>
          </div>
          <ul className="divide-y divide-line">
            {staff.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar member={m} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">
                    {m.name}
                  </div>
                  <div className="truncate text-xs text-ink-soft">
                    {m.title ?? m.department}
                  </div>
                </div>
                <RoleBadge role={m.role} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
