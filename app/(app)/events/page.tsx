"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import {
  EVENT_CATEGORY,
  type EventCategory,
  type EventTemplate,
} from "@/lib/types";
import { shortDate } from "@/lib/format";
import { Plus, MapPin, Clock, ChevronRight, X, ListChecks } from "lucide-react";

function progress(done: number, total: number) {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

export default function EventsPage() {
  const { data } = useStore();
  const { can } = useAuth();
  const manage = can("manage_events");
  const [creating, setCreating] = useState<null | { template?: EventTemplate }>(
    null
  );

  const upcoming = [...data.events].sort((a, b) =>
    a.date < b.date ? -1 : 1
  );

  return (
    <>
      <PageHeader
        eyebrow="Planning"
        title="Events"
        subtitle="Plan every service and event from one place, with reusable templates."
        action={
          manage && (
            <button
              onClick={() => setCreating({})}
              className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              <Plus size={16} /> New event
            </button>
          )
        }
      />

      <div className="space-y-8 p-5 sm:p-8">
        {/* Upcoming events */}
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
            Upcoming events
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {upcoming.map((e) => {
              const cat = EVENT_CATEGORY[e.category];
              const done = e.tasks.filter((t) => t.done).length;
              const pct = progress(done, e.tasks.length);
              const owner = data.members.find((m) => m.id === e.ownerId);
              return (
                <Link
                  key={e.id}
                  href={`/events/${e.id}`}
                  className="card group p-5 transition hover:border-brand hover:shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink-soft">
                      <span>{cat.emoji}</span> {cat.label}
                    </span>
                    <span className="text-sm font-bold text-brand">
                      {shortDate(e.date)}
                    </span>
                  </div>
                  <h3 className="mb-1 font-bold leading-snug text-ink">
                    {e.title}
                  </h3>
                  <div className="mb-4 space-y-1 text-xs text-ink-soft">
                    {e.time && (
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} /> {e.time}
                      </div>
                    )}
                    {e.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin size={12} /> {e.location}
                      </div>
                    )}
                  </div>

                  {/* Progress */}
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-ink-soft">
                      {done}/{e.tasks.length} tasks done
                    </span>
                    <span className="font-semibold text-ink">{pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-brand transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    {owner ? (
                      <div className="flex items-center gap-1.5">
                        <Avatar member={owner} size={22} />
                        <span className="text-xs text-ink-soft">
                          {owner.name.split(" ")[0]}
                        </span>
                      </div>
                    ) : (
                      <span />
                    )}
                    <ChevronRight
                      size={16}
                      className="text-ink-soft/40 transition group-hover:translate-x-0.5 group-hover:text-brand"
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Templates */}
        <section>
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-ink-soft">
            Event templates
          </h2>
          <p className="mb-3 text-sm text-ink-soft">
            Start a new event with a ready-made checklist. Every step gets a due
            date counted back from the event.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.templates.map((tpl) => {
              const cat = EVENT_CATEGORY[tpl.category];
              return (
                <div key={tpl.id} className="card flex flex-col p-5">
                  <div className="mb-2 text-2xl">{cat.emoji}</div>
                  <h3 className="font-bold text-ink">{tpl.name}</h3>
                  <p className="mt-1 flex-1 text-xs text-ink-soft">
                    {tpl.description}
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-ink-soft">
                    <ListChecks size={13} /> {tpl.items.length} steps
                  </div>
                  {manage && (
                    <button
                      onClick={() => setCreating({ template: tpl })}
                      className="mt-4 rounded-lg border border-line py-2 text-sm font-semibold text-brand transition hover:bg-brand-soft"
                    >
                      Use template
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {creating && (
        <NewEventModal
          template={creating.template}
          onClose={() => setCreating(null)}
        />
      )}
    </>
  );
}

function NewEventModal({
  template,
  onClose,
}: {
  template?: EventTemplate;
  onClose: () => void;
}) {
  const { data, createEvent } = useStore();
  const router = useRouter();
  const [title, setTitle] = useState(template ? `${template.name} — ` : "");
  const [category, setCategory] = useState<EventCategory>(
    template?.category ?? "service"
  );
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [notes, setNotes] = useState("");

  const field =
    "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

  const submit = () => {
    if (!title.trim() || !date) return;
    const id = createEvent({
      title: title.trim(),
      category,
      date,
      time: time || undefined,
      location: location || undefined,
      ownerId: ownerId || undefined,
      notes: notes || undefined,
      template,
    });
    onClose();
    router.push(`/events/${id}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink">New event</h2>
            {template && (
              <p className="text-xs text-ink-soft">
                From template: {template.name} · {template.items.length} steps
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-soft hover:bg-surface-2"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-soft">
              Event title
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sunday Service"
              className={field}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as EventCategory)}
                className={field}
              >
                {Object.entries(EVENT_CATEGORY).map(([id, c]) => (
                  <option key={id} value={id}>
                    {c.emoji} {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">
                Owner
              </label>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className={field}
              >
                <option value="">Unassigned</option>
                {data.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">
                Time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={field}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-soft">
              Location
            </label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Main Auditorium"
              className={field}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-soft">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={`${field} resize-none`}
            />
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold text-ink-soft hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!title.trim() || !date}
            className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
          >
            Create event
          </button>
        </div>
      </div>
    </div>
  );
}
