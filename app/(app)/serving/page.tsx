"use client";

import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { Check } from "lucide-react";

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function upcomingSundays(count: number): Date[] {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); // next Sunday (today if Sun)
  const out: Date[] = [];
  for (let i = 0; i < count; i++) {
    out.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return out;
}

export default function ServingPage() {
  const { data, toggleAvailability } = useStore();
  const { user, can } = useAuth();
  const seeRoster = can("manage_schedule"); // Team Lead and up
  if (!user) return null;

  const sundays = upcomingSundays(8);

  return (
    <>
      <PageHeader
        eyebrow="Serving"
        title="Serving Availability"
        subtitle="Tap the Sundays you can serve. Leaders use this to build rosters."
      />

      <div className="space-y-3 p-5 sm:p-8">
        {sundays.map((date) => {
          const day = isoDay(date);
          const mine = data.availability.some(
            (a) => a.memberId === user.id && a.date === day
          );
          const available = data.availability
            .filter((a) => a.date === day)
            .map((a) => data.members.find((m) => m.id === a.memberId))
            .filter(Boolean);
          return (
            <div
              key={day}
              className="card flex flex-wrap items-center gap-4 p-4"
            >
              <div className="w-28 shrink-0">
                <div className="text-sm font-bold text-ink">
                  {date.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
                <div className="text-xs text-ink-soft">Sunday</div>
              </div>

              <button
                onClick={() => toggleAvailability(user.id, day, !mine)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  mine
                    ? "bg-brand text-white hover:bg-brand-dark"
                    : "border border-line text-ink-soft hover:bg-surface-2"
                }`}
              >
                {mine ? <Check size={15} /> : null}
                {mine ? "I can serve" : "Mark available"}
              </button>

              {seeRoster && (
                <div className="ml-auto flex items-center gap-2">
                  {available.length === 0 ? (
                    <span className="text-xs text-ink-soft">
                      No one yet
                    </span>
                  ) : (
                    <>
                      <div className="flex -space-x-2">
                        {available.slice(0, 6).map(
                          (m) =>
                            m && (
                              <div
                                key={m.id}
                                className="rounded-full ring-2 ring-surface"
                                title={m.name}
                              >
                                <Avatar member={m} size={28} />
                              </div>
                            )
                        )}
                      </div>
                      <span className="text-xs font-semibold text-ink-soft">
                        {available.length} available
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
