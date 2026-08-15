"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import {
  ROLE_LABEL,
  ROLE_PERMISSIONS,
  type Role,
  type Permission,
} from "@/lib/types";
import { getSupabase } from "@/lib/supabase/client";
import {
  regenerateInviteCode,
  activateSubscriptionTest,
} from "@/lib/supabase/data";
import { PLANS } from "@/lib/types";
import { Check, Minus, RotateCcw, Copy, RefreshCw, Loader2 } from "lucide-react";
import { useState } from "react";

const ROLES: Role[] = ["admin", "pastor", "lead", "volunteer"];

const PERM_LABEL: Record<Permission, string> = {
  manage_users: "Manage users & roles",
  post_announcement: "Post announcements",
  manage_schedule: "Manage production schedule",
  manage_events: "Plan & manage events",
  manage_channels: "Create teams / departments",
  view_admin: "Access admin area",
};

const ALL_PERMS = Object.keys(PERM_LABEL) as Permission[];

export default function AdminPage() {
  const { user, can } = useAuth();
  const { data, setMemberRole, setMemberDepartment, approveMember, reset } =
    useStore();
  const pending = data.members.filter((m) => m.approved === false);
  const router = useRouter();

  useEffect(() => {
    if (user && !can("view_admin")) router.replace("/dashboard");
  }, [user, can, router]);

  if (!user || !can("view_admin")) return null;
  const canManage = can("manage_users");

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Roles & Permissions"
        subtitle="Control who can do what across the workspace."
        action={
          <button
            onClick={() => {
              if (confirm("Reset all demo data to defaults?")) reset();
            }}
            className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-surface-2"
          >
            <RotateCcw size={15} /> Reset demo
          </button>
        }
      />

      <div className="space-y-8 p-5 sm:p-8">
        {/* Invite code + billing */}
        {data.org && <InviteCard />}
        {data.org && <BillingCard />}

        {/* Pending approvals */}
        {pending.length > 0 && (
          <section className="card overflow-hidden ring-2 ring-amber-200">
            <div className="border-b border-line bg-amber-50 px-5 py-3.5">
              <h2 className="font-bold text-ink">
                Pending approvals ({pending.length})
              </h2>
              <p className="text-xs text-ink-soft">
                New sign-ups waiting for you to let them in.
              </p>
            </div>
            <ul className="divide-y divide-line">
              {pending.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar member={m} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">
                      {m.name}
                    </div>
                    <div className="truncate text-xs text-ink-soft">
                      {m.email}
                    </div>
                  </div>
                  <button
                    onClick={() => approveMember(m.id, true)}
                    className="rounded-lg bg-brand px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark"
                  >
                    Approve
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Member roles */}
        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="font-bold text-ink">Team members</h2>
            <p className="text-xs text-ink-soft">
              {canManage
                ? "Set each person's department and role. Pick “+ Add new department” to create one."
                : "You can view roles. Only Admins can change them."}
            </p>
          </div>
          <ul className="divide-y divide-line">
            {data.members.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-3 px-5 py-3"
              >
                <Avatar member={m} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">
                    {m.name}
                  </div>
                  <div className="truncate text-xs text-ink-soft">
                    {m.title ?? m.role} · {m.department}
                  </div>
                </div>
                {canManage ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <DepartmentSelect
                      value={m.department}
                      onChange={(dept) => setMemberDepartment(m.id, dept)}
                      className="w-40 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-brand"
                    />
                    <select
                      value={m.role}
                      onChange={(e) =>
                        setMemberRole(m.id, e.target.value as Role)
                      }
                      className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className="text-sm font-semibold text-ink-soft">
                    {ROLE_LABEL[m.role]}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Permission matrix */}
        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="font-bold text-ink">Permission matrix</h2>
            <p className="text-xs text-ink-soft">
              What each role can do. This is the source of truth for access.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-5 py-3 font-semibold text-ink-soft">
                    Permission
                  </th>
                  {ROLES.map((r) => (
                    <th
                      key={r}
                      className="px-4 py-3 text-center font-semibold text-ink"
                    >
                      {ROLE_LABEL[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_PERMS.map((perm) => (
                  <tr key={perm} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 text-ink">{PERM_LABEL[perm]}</td>
                    {ROLES.map((r) => {
                      const has = ROLE_PERMISSIONS[r].includes(perm);
                      return (
                        <td key={r} className="px-4 py-3 text-center">
                          {has ? (
                            <Check
                              size={17}
                              className="mx-auto text-ok"
                              strokeWidth={3}
                            />
                          ) : (
                            <Minus
                              size={16}
                              className="mx-auto text-line"
                              strokeWidth={3}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

// Admins share this code so their team can join the right church.
function InviteCard() {
  const { data } = useStore();
  const [code, setCode] = useState(data.org?.inviteCode ?? "");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const roll = async () => {
    const sb = getSupabase();
    if (!sb) return;
    if (
      !confirm(
        "Generate a new invite code? The old one stops working immediately."
      )
    )
      return;
    setBusy(true);
    const res = await regenerateInviteCode(sb);
    setBusy(false);
    if (res.code) setCode(res.code);
  };

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-line px-5 py-3.5">
        <h2 className="font-bold text-ink">Invite your team</h2>
        <p className="text-xs text-ink-soft">
          Share this code. Anyone who signs up and enters it joins{" "}
          {data.org?.name} — pending your approval.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3 p-5">
        <code className="rounded-xl border border-line bg-surface-2 px-5 py-3 text-2xl font-bold tracking-[0.3em] text-ink">
          {code}
        </code>
        <button
          onClick={copy}
          className="flex items-center gap-2 rounded-xl border border-line px-3.5 py-2.5 text-sm font-semibold text-ink-soft hover:bg-surface-2"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          onClick={roll}
          disabled={busy}
          className="flex items-center gap-2 rounded-xl border border-line px-3.5 py-2.5 text-sm font-semibold text-ink-soft hover:bg-surface-2 disabled:opacity-50"
        >
          <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
          New code
        </button>
      </div>
    </section>
  );
}

// Plan + subscription state for this church. Payment is stubbed in test mode.
function BillingCard() {
  const { data } = useStore();
  const org = data.org;
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(org?.status ?? "trialing");
  const [plan, setPlan] = useState(org?.plan ?? "starter");

  const activate = async (planId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    const res = await activateSubscriptionTest(sb, planId);
    setBusy(false);
    if (!res.error) {
      setPlan(planId as typeof plan);
      setStatus("active");
    }
  };

  const trialLeft = org?.trialEndsAt
    ? Math.ceil(
        (new Date(org.trialEndsAt).getTime() - Date.now()) / 86400000
      )
    : null;

  const badge: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    trialing: "bg-brand-soft text-brand-dark",
    past_due: "bg-amber-100 text-amber-700",
    canceled: "bg-slate-100 text-slate-600",
    suspended: "bg-red-100 text-red-700",
  };

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-ink">Plan &amp; billing</h2>
          <p className="text-xs text-ink-soft">
            {status === "trialing" && trialLeft !== null
              ? `Free trial — ${trialLeft > 0 ? `${trialLeft} days left` : "ended"}`
              : `Your church is on the ${plan} plan.`}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
            badge[status] ?? "bg-slate-100"
          }`}
        >
          {status}
        </span>
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-3">
        {PLANS.map((p) => {
          const current = plan === p.id && status === "active";
          return (
            <div
              key={p.id}
              className={`rounded-xl border p-4 ${
                current ? "border-brand ring-1 ring-brand" : "border-line"
              }`}
            >
              <div className="font-bold text-ink">{p.name}</div>
              <div className="mt-0.5 text-sm text-ink">
                <span className="font-bold">{p.price}</span>{" "}
                <span className="text-xs text-ink-soft">{p.cadence}</span>
              </div>
              <ul className="mt-3 space-y-1">
                {p.features.slice(0, 3).map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-1.5 text-xs text-ink-soft"
                  >
                    <Check size={12} className="mt-0.5 shrink-0 text-brand" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => activate(p.id)}
                disabled={busy || current}
                className={`mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition ${
                  current
                    ? "cursor-default bg-surface-2 text-ink-soft"
                    : "bg-brand text-white hover:bg-brand-dark"
                } disabled:opacity-60`}
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                {current ? "Current plan" : `Choose ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>

      <p className="border-t border-line bg-surface-2 px-5 py-3 text-xs text-ink-soft">
        <b>Test mode.</b> Choosing a plan activates it immediately without
        collecting payment. Real checkout plugs in here when you&apos;re ready.
      </p>
    </section>
  );
}
