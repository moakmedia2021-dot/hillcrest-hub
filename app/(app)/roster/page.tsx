"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { allDepartments } from "@/lib/departments";
import { POSITION_SUGGESTIONS } from "@/lib/types";
import { Plus, Trash2, Send, Sparkles, CircleCheck } from "lucide-react";

function upcomingSundays(count: number): string[] {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 7);
  }
  return out;
}

const pretty = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

export default function RosterPage() {
  const { data, addAssignment, setAssignmentMember, deleteAssignment, publishRoster } =
    useStore();
  const { user, can } = useAuth();
  const router = useRouter();

  const sundays = useMemo(() => upcomingSundays(8), []);
  const departments = allDepartments(data);

  const [date, setDate] = useState(sundays[0]);
  const [dept, setDept] = useState(user?.department ?? departments[0] ?? "Creative");
  const [newPos, setNewPos] = useState("");
  const [time, setTime] = useState("9:00 AM");

  useEffect(() => {
    if (user && !can("manage_schedule")) router.replace("/my-sunday");
  }, [user, can, router]);
  if (!user || !can("manage_schedule")) return null;

  const slots = data.assignments
    .filter((a) => a.date === date && a.department === dept)
    .sort((a, b) => a.position.localeCompare(b.position));

  // People in this department, with the ones who marked themselves available first.
  const deptMembers = data.members.filter((m) => m.department === dept);
  const availableIds = new Set(
    data.availability.filter((a) => a.date === date).map((a) => a.memberId)
  );
  const isAvailable = (id: string) => availableIds.has(id);
  const alreadyOn = new Set(slots.map((s) => s.memberId).filter(Boolean));

  const suggestions = (POSITION_SUGGESTIONS[dept] ?? []).filter(
    (p) => !slots.some((s) => s.position === p)
  );

  const add = (position: string) => {
    const p = position.trim();
    if (!p) return;
    addAssignment({ date, department: dept, position: p, time, published: false });
    setNewPos("");
  };

  // Fill every open slot with someone who said they're available.
  const autoFill = () => {
    const pool = deptMembers
      .filter((m) => isAvailable(m.id) && !alreadyOn.has(m.id))
      .map((m) => m.id);
    let i = 0;
    for (const s of slots) {
      if (s.memberId) continue;
      if (i >= pool.length) break;
      setAssignmentMember(s.id, pool[i]);
      i++;
    }
  };

  const openCount = slots.filter((s) => !s.memberId).length;
  const published = slots.length > 0 && slots.every((s) => s.published);

  const select =
    "rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

  return (
    <>
      <PageHeader
        eyebrow="Serving"
        title="Roster Builder"
        subtitle="Build the schedule, fill open spots, and publish it to your team."
        action={
          slots.length > 0 && (
            <button
              onClick={() => publishRoster(date, dept)}
              disabled={published}
              className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
            >
              {published ? <CircleCheck size={16} /> : <Send size={16} />}
              {published ? "Published" : "Publish roster"}
            </button>
          )
        }
      />

      <div className="space-y-5 p-4 sm:p-8">
        {/* Date + department */}
        <div className="flex flex-wrap gap-3">
          <label className="flex-1 min-w-[10rem]">
            <span className="mb-1 block text-xs font-semibold text-ink-soft">
              Service date
            </span>
            <select
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${select} w-full`}
            >
              {sundays.map((s) => (
                <option key={s} value={s}>
                  {pretty(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1 min-w-[10rem]">
            <span className="mb-1 block text-xs font-semibold text-ink-soft">
              Department
            </span>
            <select
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              className={`${select} w-full`}
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1 min-w-[8rem]">
            <span className="mb-1 block text-xs font-semibold text-ink-soft">
              Call time
            </span>
            <input
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="9:00 AM"
              className={`${select} w-full`}
            />
          </label>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {/* Slots */}
          <div className="card overflow-hidden lg:col-span-2">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-ink">
                  {dept} · {pretty(date)}
                </h2>
                <p className="text-xs text-ink-soft">
                  {slots.length} position{slots.length === 1 ? "" : "s"}
                  {openCount > 0 && ` · ${openCount} open`}
                  {published && " · published"}
                </p>
              </div>
              {openCount > 0 && (
                <button
                  onClick={autoFill}
                  className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand-soft"
                >
                  <Sparkles size={14} /> Auto-fill available
                </button>
              )}
            </div>

            {slots.length === 0 ? (
              <p className="p-5 text-sm text-ink-soft">
                No positions yet. Add them below to start the roster.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {slots.map((s) => {
                  const who = data.members.find((m) => m.id === s.memberId);
                  return (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center gap-3 px-5 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-ink">
                          {s.position}
                        </div>
                        <div className="text-xs text-ink-soft">
                          {s.time ?? "—"}
                        </div>
                      </div>
                      {who && <Avatar member={who} size={26} />}
                      <select
                        value={s.memberId ?? ""}
                        onChange={(e) =>
                          setAssignmentMember(s.id, e.target.value || null)
                        }
                        className={`${select} max-w-[11rem] flex-1`}
                      >
                        <option value="">— Open —</option>
                        {deptMembers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                            {isAvailable(m.id) ? " ✓ available" : ""}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => deleteAssignment(s.id)}
                        className="rounded-lg p-2 text-ink-soft hover:bg-red-50 hover:text-danger"
                        title="Remove position"
                      >
                        <Trash2 size={15} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Add position */}
            <div className="border-t border-line p-4">
              <div className="flex gap-2">
                <input
                  value={newPos}
                  onChange={(e) => setNewPos(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && add(newPos)}
                  placeholder="Add a position — e.g. Camera 2"
                  className={`${select} flex-1`}
                />
                <button
                  onClick={() => add(newPos)}
                  disabled={!newPos.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
                >
                  <Plus size={15} /> Add
                </button>
              </div>
              {suggestions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {suggestions.map((p) => (
                    <button
                      key={p}
                      onClick={() => add(p)}
                      className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-soft transition hover:border-brand hover:text-brand"
                    >
                      + {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Who's available */}
          <div className="card h-fit">
            <div className="border-b border-line px-5 py-3.5">
              <h2 className="font-bold text-ink">Available {pretty(date)}</h2>
              <p className="text-xs text-ink-soft">
                From what your team marked on the Serving page.
              </p>
            </div>
            {deptMembers.filter((m) => isAvailable(m.id)).length === 0 ? (
              <p className="p-5 text-sm text-ink-soft">
                Nobody in {dept} has marked this date yet.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {deptMembers
                  .filter((m) => isAvailable(m.id))
                  .map((m) => (
                    <li key={m.id} className="flex items-center gap-3 px-5 py-2.5">
                      <Avatar member={m} size={28} />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">
                        {m.name}
                      </span>
                      {alreadyOn.has(m.id) && (
                        <span className="shrink-0 text-xs font-semibold text-brand">
                          scheduled
                        </span>
                      )}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
