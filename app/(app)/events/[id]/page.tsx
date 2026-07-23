"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { Avatar } from "@/components/Avatar";
import { EVENT_CATEGORY } from "@/lib/types";
import { shortDate, dueMeta } from "@/lib/format";
import {
  ArrowLeft,
  Clock,
  MapPin,
  Trash2,
  Check,
  CalendarDays,
} from "lucide-react";

const toneClass = {
  ok: "text-ink-soft",
  warn: "text-warn",
  danger: "text-danger",
  muted: "text-ink-soft",
} as const;

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data, toggleEventTask, assignEventTask, deleteEvent } = useStore();
  const { can } = useAuth();
  const manage = can("manage_events");

  const event = data.events.find((e) => e.id === id);

  if (!event) {
    return (
      <div className="p-8">
        <Link href="/events" className="text-sm font-semibold text-brand">
          ← Back to events
        </Link>
        <p className="mt-4 text-ink-soft">Event not found.</p>
      </div>
    );
  }

  const cat = EVENT_CATEGORY[event.category];
  const owner = data.members.find((m) => m.id === event.ownerId);
  const done = event.tasks.filter((t) => t.done).length;
  const pct =
    event.tasks.length === 0
      ? 0
      : Math.round((done / event.tasks.length) * 100);

  return (
    <div className="mx-auto max-w-3xl p-5 sm:p-8">
      <Link
        href="/events"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-brand"
      >
        <ArrowLeft size={15} /> All events
      </Link>

      {/* Header card */}
      <div className="card overflow-hidden">
        <div className="border-b border-line p-6">
          <div className="mb-3 flex items-start justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-ink-soft">
              <span>{cat.emoji}</span> {cat.label}
            </span>
            {manage && (
              <button
                onClick={() => {
                  if (confirm("Delete this event?")) {
                    deleteEvent(event.id);
                    router.push("/events");
                  }
                }}
                className="rounded-lg p-2 text-ink-soft hover:bg-red-50 hover:text-danger"
                title="Delete event"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
          <h1 className="text-2xl font-bold text-ink">{event.title}</h1>

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
            <span className="flex items-center gap-1.5">
              <CalendarDays size={15} /> {shortDate(event.date)}
            </span>
            {event.time && (
              <span className="flex items-center gap-1.5">
                <Clock size={15} /> {event.time}
              </span>
            )}
            {event.location && (
              <span className="flex items-center gap-1.5">
                <MapPin size={15} /> {event.location}
              </span>
            )}
            {owner && (
              <span className="flex items-center gap-1.5">
                <Avatar member={owner} size={20} /> {owner.name}
              </span>
            )}
          </div>

          {event.notes && (
            <p className="mt-4 rounded-lg bg-surface-2 p-3 text-sm text-ink">
              {event.notes}
            </p>
          )}
        </div>

        {/* Progress */}
        <div className="px-6 py-4">
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="font-semibold text-ink">Planning checklist</span>
            <span className="text-ink-soft">
              {done}/{event.tasks.length} done · {pct}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div className="card mt-5 divide-y divide-line">
        {event.tasks.length === 0 && (
          <p className="p-5 text-sm text-ink-soft">
            No checklist items. This event was created blank.
          </p>
        )}
        {event.tasks.map((t) => {
          const who = data.members.find((m) => m.id === t.assigneeId);
          const due = dueMeta(t.dueDate);
          return (
            <div key={t.id} className="flex items-center gap-3 p-4">
              <button
                onClick={() => toggleEventTask(event.id, t.id)}
                disabled={!manage}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition ${
                  t.done
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-surface hover:border-brand"
                } ${!manage ? "cursor-default" : ""}`}
                aria-label={t.done ? "Mark incomplete" : "Mark complete"}
              >
                {t.done && <Check size={14} strokeWidth={3} />}
              </button>

              <div className="min-w-0 flex-1">
                <div
                  className={`text-sm font-medium ${
                    t.done ? "text-ink-soft line-through" : "text-ink"
                  }`}
                >
                  {t.label}
                </div>
                {t.dueDate && !t.done && (
                  <div className={`text-xs font-semibold ${toneClass[due.tone]}`}>
                    {due.label}
                  </div>
                )}
              </div>

              {manage ? (
                <select
                  value={t.assigneeId ?? ""}
                  onChange={(e) =>
                    assignEventTask(event.id, t.id, e.target.value)
                  }
                  className="max-w-[9rem] rounded-lg border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-brand"
                >
                  <option value="">Assign…</option>
                  {data.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              ) : (
                who && <Avatar member={who} size={26} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
