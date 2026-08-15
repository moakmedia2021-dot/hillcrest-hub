"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { getSupabase } from "@/lib/supabase/client";
import {
  platformOverview,
  platformSetOrgStatus,
  type PlatformOverview,
} from "@/lib/supabase/data";
import {
  Building2,
  Users,
  CheckCircle2,
  Clock,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

const STATUSES = ["trialing", "active", "past_due", "canceled", "suspended"];

const STATUS_STYLE: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  trialing: "bg-brand-soft text-brand-dark",
  past_due: "bg-amber-100 text-amber-700",
  canceled: "bg-slate-100 text-slate-600",
  suspended: "bg-red-100 text-red-700",
};

export default function AppAdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<PlatformOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await platformOverview(sb);
    setLoading(false);
    if (res.error) setError(res.error);
    else {
      setError(null);
      setData(res.data ?? null);
    }
  }, []);

  // Route guard — the RPC also rejects non-platform-admins server-side.
  useEffect(() => {
    if (user && !user.platformAdmin) router.replace("/dashboard");
  }, [user, router]);

  useEffect(() => {
    if (user?.platformAdmin) load();
  }, [user?.platformAdmin, load]);

  if (!user?.platformAdmin) return null;

  const setStatus = async (orgId: string, status: string) => {
    const sb = getSupabase();
    if (!sb) return;
    await platformSetOrgStatus(sb, orgId, status);
    load();
  };

  const t = data?.totals;
  const stats = [
    { label: "Churches", value: t?.churches ?? 0, icon: Building2 },
    { label: "Members", value: t?.members ?? 0, icon: Users },
    { label: "Active", value: t?.active ?? 0, icon: CheckCircle2 },
    { label: "Trialing", value: t?.trialing ?? 0, icon: Clock },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Internal · Platform"
        title="App Admin"
        subtitle="Every church on the platform. Visible only to the platform team."
        action={
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-surface-2 disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        }
      />

      <div className="space-y-6 p-4 sm:p-8">
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <ShieldAlert size={17} className="mt-0.5 shrink-0" />
          <p>
            Internal tooling. Platform access is granted only by direct database
            update — it can&apos;t be assigned from inside the app.
          </p>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {/* Totals */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="card p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand-dark">
                <s.icon size={18} />
              </div>
              <div className="text-2xl font-bold text-ink">{s.value}</div>
              <div className="text-xs text-ink-soft">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Churches */}
        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="font-bold text-ink">Churches</h2>
            <p className="text-xs text-ink-soft">
              Usage and subscription status for every organization.
            </p>
          </div>

          {loading && !data ? (
            <p className="p-5 text-sm text-ink-soft">Loading…</p>
          ) : !data?.orgs.length ? (
            <p className="p-5 text-sm text-ink-soft">No churches yet.</p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                      <th className="px-5 py-3 font-semibold">Church</th>
                      <th className="px-3 py-3 font-semibold">Plan</th>
                      <th className="px-3 py-3 font-semibold">Status</th>
                      <th className="px-3 py-3 text-right font-semibold">Members</th>
                      <th className="px-3 py-3 text-right font-semibold">Pending</th>
                      <th className="px-3 py-3 text-right font-semibold">Messages</th>
                      <th className="px-3 py-3 text-right font-semibold">Events</th>
                      <th className="px-5 py-3 font-semibold">Set status</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {data.orgs.map((o) => (
                      <tr key={o.id} className="border-b border-line last:border-0">
                        <td className="px-5 py-3">
                          <div className="font-semibold text-ink">{o.name}</div>
                          <div className="font-mono text-xs text-ink-soft">
                            {o.invite_code}
                          </div>
                        </td>
                        <td className="px-3 py-3 capitalize text-ink-soft">
                          {o.plan}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              STATUS_STYLE[o.status] ?? "bg-slate-100"
                            }`}
                          >
                            {o.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-ink">{o.members}</td>
                        <td className="px-3 py-3 text-right text-ink-soft">
                          {o.pending}
                        </td>
                        <td className="px-3 py-3 text-right text-ink-soft">
                          {o.messages}
                        </td>
                        <td className="px-3 py-3 text-right text-ink-soft">
                          {o.events}
                        </td>
                        <td className="px-5 py-3">
                          <select
                            value={o.status}
                            onChange={(e) => setStatus(o.id, e.target.value)}
                            className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs outline-none focus:border-brand"
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className="divide-y divide-line md:hidden">
                {data.orgs.map((o) => (
                  <li key={o.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-ink">
                          {o.name}
                        </div>
                        <div className="font-mono text-xs text-ink-soft">
                          {o.invite_code} · {o.plan}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          STATUS_STYLE[o.status] ?? "bg-slate-100"
                        }`}
                      >
                        {o.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center tabular-nums">
                      {[
                        ["Members", o.members],
                        ["Pending", o.pending],
                        ["Msgs", o.messages],
                        ["Events", o.events],
                      ].map(([label, val]) => (
                        <div
                          key={label as string}
                          className="rounded-lg bg-surface-2 py-2"
                        >
                          <div className="text-sm font-bold text-ink">{val}</div>
                          <div className="text-[10px] uppercase text-ink-soft">
                            {label}
                          </div>
                        </div>
                      ))}
                    </div>
                    <select
                      value={o.status}
                      onChange={(e) => setStatus(o.id, e.target.value)}
                      className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          Set status: {s}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </>
  );
}
