"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { getSupabase } from "@/lib/supabase/client";
import {
  requestSub,
  acceptSubRequest,
  cancelSubRequest,
} from "@/lib/supabase/data";
import {
  CalendarCheck,
  Clock,
  MapPin,
  Users,
  HandHelping,
  Loader2,
  X,
  CheckCircle2,
} from "lucide-react";

const todayIso = () => new Date().toISOString().slice(0, 10);

function prettyDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function daysAway(iso: string) {
  const diff = Math.round(
    (new Date(iso + "T12:00:00").getTime() -
      new Date(todayIso() + "T12:00:00").getTime()) /
      86400000
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `In ${diff} days`;
}

export default function MySundayPage() {
  const { data } = useStore();
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  if (!user) return null;

  const today = todayIso();
  const mine = data.assignments
    .filter((a) => a.memberId === user.id && a.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const next = mine[0];
  const later = mine.slice(1);

  const openSubIds = new Set(
    data.subRequests.filter((s) => s.status === "open").map((s) => s.assignmentId)
  );

  // Open sub requests I could cover — my department, not my own slot.
  const coverable = data.subRequests
    .filter((s) => s.status === "open")
    .map((s) => ({
      req: s,
      a: data.assignments.find((x) => x.id === s.assignmentId),
    }))
    .filter(
      (x) =>
        x.a &&
        x.a.date >= today &&
        x.a.memberId !== user.id &&
        (x.a.department === user.department ||
          user.role === "admin" ||
          user.role === "lead")
    );

  const flash = (m: string) => {
    setNotice(m);
    setTimeout(() => setNotice(null), 4000);
  };

  const doRequest = async (assignmentId: string) => {
    const sb = getSupabase();
    if (!sb) return flash("Sub requests need the live database.");
    setBusy(assignmentId);
    const res = await requestSub(sb, assignmentId, reason.trim() || undefined);
    setBusy(null);
    setAsking(null);
    setReason("");
    flash(res.error ?? "Sub request sent to your team.");
  };

  const doAccept = async (reqId: string) => {
    const sb = getSupabase();
    if (!sb) return flash("Needs the live database.");
    setBusy(reqId);
    const res = await acceptSubRequest(sb, reqId);
    setBusy(null);
    flash(res.error ?? "You've got it — thanks for covering!");
  };

  const doCancel = async (reqId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    setBusy(reqId);
    await cancelSubRequest(sb, reqId);
    setBusy(null);
    flash("Sub request withdrawn.");
  };

  const teammates = (a: (typeof mine)[number]) =>
    data.assignments
      .filter(
        (x) => x.date === a.date && x.department === a.department && x.id !== a.id
      )
      .map((x) => ({ x, m: data.members.find((m) => m.id === x.memberId) }));

  return (
    <>
      <PageHeader
        eyebrow="Serving"
        title="My Sunday"
        subtitle="Everything you're scheduled for, and who you're serving with."
      />

      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
        {notice && (
          <p className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-medium text-brand-dark">
            {notice}
          </p>
        )}

        {/* Next up */}
        {!next ? (
          <div className="card p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-ink-soft">
              <CalendarCheck size={22} />
            </div>
            <h2 className="font-bold text-ink">Nothing scheduled yet</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">
              When your leader publishes the roster, your spot will show up
              here. Mark the dates you can serve on the Serving page.
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 bg-brand px-5 py-3 text-white">
              <span className="text-sm font-bold">You&apos;re up next</span>
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">
                {daysAway(next.date)}
              </span>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <div className="text-xl font-bold text-ink sm:text-2xl">
                  {next.position}
                </div>
                <div className="text-sm text-ink-soft">
                  {next.department} · {prettyDate(next.date)}
                </div>
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
                {next.time && (
                  <span className="flex items-center gap-1.5">
                    <Clock size={15} /> {next.time}
                  </span>
                )}
                {next.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={15} /> {next.location}
                  </span>
                )}
              </div>

              {next.notes && (
                <p className="rounded-lg bg-surface-2 p-3 text-sm text-ink">
                  {next.notes}
                </p>
              )}

              {/* Who else is serving */}
              {teammates(next).length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-soft">
                    <Users size={13} /> Serving with you
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {teammates(next).map(({ x, m }) => (
                      <span
                        key={x.id}
                        className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 text-sm"
                      >
                        {m ? (
                          <Avatar member={m} size={22} />
                        ) : (
                          <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-surface-2 text-[10px] text-ink-soft">
                            ?
                          </span>
                        )}
                        <span className="text-ink">
                          {m ? m.name.split(" ")[0] : "Open"}
                        </span>
                        <span className="text-xs text-ink-soft">
                          {x.position}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Can't make it */}
              {openSubIds.has(next.id) ? (
                <div className="flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <span className="flex-1">
                    Sub request is open — your team can pick it up.
                  </span>
                  {(() => {
                    const req = data.subRequests.find(
                      (s) => s.assignmentId === next.id && s.status === "open"
                    );
                    return req ? (
                      <button
                        onClick={() => doCancel(req.id)}
                        disabled={busy === req.id}
                        className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold hover:bg-amber-100"
                      >
                        Never mind
                      </button>
                    ) : null;
                  })()}
                </div>
              ) : asking === next.id ? (
                <div className="space-y-2 rounded-xl border border-line p-3">
                  <input
                    autoFocus
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason (optional)"
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base outline-none focus:border-brand sm:text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAsking(null)}
                      className="flex-1 rounded-lg border border-line py-2 text-sm font-semibold text-ink-soft"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => doRequest(next.id)}
                      disabled={busy === next.id}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand py-2 text-sm font-semibold text-white"
                    >
                      {busy === next.id && (
                        <Loader2 size={14} className="animate-spin" />
                      )}
                      Send request
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAsking(next.id)}
                  className="w-full rounded-xl border border-line py-3 text-sm font-semibold text-ink-soft transition hover:border-danger/40 hover:bg-red-50 hover:text-danger"
                >
                  I can&apos;t make it — request a sub
                </button>
              )}
            </div>
          </div>
        )}

        {/* Coming up */}
        {later.length > 0 && (
          <section className="card overflow-hidden">
            <div className="border-b border-line px-5 py-3.5">
              <h2 className="font-bold text-ink">Coming up</h2>
            </div>
            <ul className="divide-y divide-line">
              {later.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-ink">
                      {a.position}
                    </div>
                    <div className="text-xs text-ink-soft">
                      {prettyDate(a.date)}
                      {a.time ? ` · ${a.time}` : ""}
                    </div>
                  </div>
                  {openSubIds.has(a.id) ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      Sub requested
                    </span>
                  ) : (
                    <button
                      onClick={() => setAsking(a.id)}
                      className="text-xs font-semibold text-brand hover:text-brand-dark"
                    >
                      Request sub
                    </button>
                  )}
                  {asking === a.id && (
                    <div className="w-full space-y-2 rounded-xl border border-line p-3">
                      <input
                        autoFocus
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Reason (optional)"
                        className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base outline-none focus:border-brand sm:text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setAsking(null)}
                          className="flex-1 rounded-lg border border-line py-2 text-sm font-semibold text-ink-soft"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => doRequest(a.id)}
                          disabled={busy === a.id}
                          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand py-2 text-sm font-semibold text-white"
                        >
                          {busy === a.id && (
                            <Loader2 size={14} className="animate-spin" />
                          )}
                          Send request
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Help a teammate */}
        <section className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
            <HandHelping size={16} className="text-brand" />
            <h2 className="font-bold text-ink">Your team needs cover</h2>
          </div>
          {coverable.length === 0 ? (
            <p className="p-5 text-sm text-ink-soft">
              No open sub requests right now. 🎉
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {coverable.map(({ req, a }) => {
                const who = data.members.find((m) => m.id === req.requestedById);
                return (
                  <li
                    key={req.id}
                    className="flex flex-wrap items-center gap-3 px-5 py-3.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-ink">
                        {a!.position} · {prettyDate(a!.date)}
                      </div>
                      <div className="text-xs text-ink-soft">
                        {who ? `${who.name.split(" ")[0]} can't make it` : "Open slot"}
                        {req.reason ? ` — ${req.reason}` : ""}
                      </div>
                    </div>
                    <button
                      onClick={() => doAccept(req.id)}
                      disabled={busy === req.id}
                      className="flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
                    >
                      {busy === req.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={14} />
                      )}
                      I&apos;ll cover it
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}