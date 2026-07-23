"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/PageHeader";
import { EVENT_CATEGORY } from "@/lib/types";
import { ChevronLeft, ChevronRight, CalendarDays, KanbanSquare } from "lucide-react";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const iso = (d: Date) => d.toISOString().slice(0, 10);

type Item =
  | { type: "event"; id: string; title: string; emoji: string }
  | { type: "task"; id: string; title: string };

export default function CalendarPage() {
  const { data } = useStore();
  const today = new Date();
  const [cursor, setCursor] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selected, setSelected] = useState(iso(today));

  // Map day -> items (events + production tasks with due dates).
  const byDay = useMemo(() => {
    const m: Record<string, Item[]> = {};
    for (const e of data.events) {
      const day = e.date.slice(0, 10);
      (m[day] ??= []).push({
        type: "event",
        id: e.id,
        title: e.title,
        emoji: EVENT_CATEGORY[e.category].emoji,
      });
    }
    for (const t of data.tasks) {
      if (!t.dueDate) continue;
      const day = t.dueDate.slice(0, 10);
      (m[day] ??= []).push({ type: "task", id: t.id, title: t.title });
    }
    return m;
  }, [data.events, data.tasks]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const selItems = byDay[selected] ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Schedule"
        title="Calendar"
        subtitle="Events and production deadlines at a glance."
        action={
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCursor(new Date(year, month - 1, 1))}
              className="rounded-lg border border-line p-2 text-ink-soft hover:bg-surface-2"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[9rem] text-center text-sm font-bold text-ink">
              {cursor.toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </span>
            <button
              onClick={() => setCursor(new Date(year, month + 1, 1))}
              className="rounded-lg border border-line p-2 text-ink-soft hover:bg-surface-2"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        }
      />

      <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-3">
        {/* Month grid */}
        <div className="card overflow-hidden lg:col-span-2">
          <div className="grid grid-cols-7 border-b border-line bg-surface-2 text-center text-[11px] font-bold uppercase tracking-wide text-ink-soft">
            {DOW.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((date, i) => {
              if (!date) return <div key={i} className="min-h-20 border-b border-r border-line bg-surface-2/30" />;
              const key = iso(date);
              const items = byDay[key] ?? [];
              const isToday = key === iso(today);
              const isSel = key === selected;
              return (
                <button
                  key={i}
                  onClick={() => setSelected(key)}
                  className={`min-h-20 border-b border-r border-line p-1.5 text-left align-top transition hover:bg-surface-2 ${
                    isSel ? "bg-brand-soft" : ""
                  }`}
                >
                  <div
                    className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      isToday
                        ? "bg-brand text-white"
                        : "text-ink"
                    }`}
                  >
                    {date.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {items.slice(0, 3).map((it, idx) => (
                      <div
                        key={idx}
                        className={`truncate rounded px-1 py-0.5 text-[10px] font-medium ${
                          it.type === "event"
                            ? "bg-brand/10 text-brand-dark"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {it.type === "event" ? `${it.emoji} ` : "• "}
                        {it.title}
                      </div>
                    ))}
                    {items.length > 3 && (
                      <div className="px-1 text-[10px] text-ink-soft">
                        +{items.length - 3} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected day */}
        <div className="card h-fit">
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="font-bold text-ink">
              {new Date(selected).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </h2>
          </div>
          {selItems.length === 0 ? (
            <p className="p-5 text-sm text-ink-soft">Nothing scheduled.</p>
          ) : (
            <ul className="divide-y divide-line">
              {selItems.map((it, idx) => (
                <li key={idx}>
                  <Link
                    href={it.type === "event" ? `/events/${it.id}` : "/schedule"}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2"
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        it.type === "event"
                          ? "bg-brand-soft text-brand-dark"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {it.type === "event" ? (
                        <CalendarDays size={16} />
                      ) : (
                        <KanbanSquare size={16} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">
                        {it.title}
                      </div>
                      <div className="text-xs text-ink-soft">
                        {it.type === "event" ? "Event" : "Task due"}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
