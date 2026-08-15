"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase/client";
import { createOrganization, joinOrganization } from "@/lib/supabase/data";
import { PLANS, type PlanId } from "@/lib/types";
import {
  Church,
  KeyRound,
  Loader2,
  LogOut,
  ArrowLeft,
  Check,
} from "lucide-react";

// Shown to a signed-in account that doesn't belong to a church yet.
export function ChurchOnboarding() {
  const { user, signOut, refreshUser } = useAuth();
  const [mode, setMode] = useState<"choose" | "create" | "plan" | "join">(
    "choose"
  );
  const [name, setName] = useState("");
  const [plan, setPlan] = useState<PlanId>("starter");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field =
    "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand";

  const run = async (fn: () => Promise<{ error?: string }>) => {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    await refreshUser();
  };

  const create = () => {
    const sb = getSupabase();
    if (!sb || !name.trim()) return;
    run(() => createOrganization(sb, name.trim(), plan));
  };

  const join = () => {
    const sb = getSupabase();
    if (!sb || !code.trim()) return;
    run(() => joinOrganization(sb, code.trim()));
  };

  return (
    <div className="hh-hero flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <h1 className="text-2xl font-bold">
            Welcome, {user?.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-white/80">
            Let&apos;s connect you to your church.
          </p>
        </div>

        <div className="card p-6">
          {mode === "choose" && (
            <div className="space-y-3">
              <button
                onClick={() => setMode("join")}
                className="flex w-full items-center gap-3 rounded-xl border border-line px-4 py-4 text-left transition hover:border-brand hover:bg-brand-soft/40"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-dark">
                  <KeyRound size={19} />
                </div>
                <div>
                  <div className="font-semibold text-ink">
                    Join my church
                  </div>
                  <div className="text-xs text-ink-soft">
                    I have an invite code from my leader
                  </div>
                </div>
              </button>

              <button
                onClick={() => setMode("create")}
                className="flex w-full items-center gap-3 rounded-xl border border-line px-4 py-4 text-left transition hover:border-brand hover:bg-brand-soft/40"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-dark">
                  <Church size={19} />
                </div>
                <div>
                  <div className="font-semibold text-ink">
                    Set up a new church
                  </div>
                  <div className="text-xs text-ink-soft">
                    I&apos;m starting this for my team — I&apos;ll be the admin
                  </div>
                </div>
              </button>
            </div>
          )}

          {mode === "join" && (
            <div className="space-y-3">
              <BackLink onClick={() => setMode("choose")} />
              <p className="eyebrow">Join your church</p>
              <p className="text-sm text-ink-soft">
                Enter the invite code your church admin gave you.
              </p>
              <input
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && join()}
                placeholder="ABC2345"
                maxLength={12}
                className={`${field} text-center text-lg font-bold tracking-[0.3em]`}
              />
              {error && <p className="text-sm text-danger">{error}</p>}
              <button
                onClick={join}
                disabled={busy || !code.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
              >
                {busy && <Loader2 size={15} className="animate-spin" />}
                Join church
              </button>
              <p className="text-center text-xs text-ink-soft">
                Your admin will approve you before you get access.
              </p>
            </div>
          )}

          {mode === "create" && (
            <div className="space-y-3">
              <BackLink onClick={() => setMode("choose")} />
              <p className="eyebrow">Set up your church</p>
              <p className="text-sm text-ink-soft">
                You&apos;ll become the admin and get an invite code to share
                with your team.
              </p>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && name.trim() && setMode("plan")}
                placeholder="e.g. Hillcrest Assembly of God"
                className={field}
              />
              {error && <p className="text-sm text-danger">{error}</p>}
              <button
                onClick={() => setMode("plan")}
                disabled={!name.trim()}
                className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
              >
                Choose a plan
              </button>
            </div>
          )}

          {mode === "plan" && (
            <div className="space-y-3">
              <BackLink onClick={() => setMode("create")} />
              <p className="eyebrow">Pick a plan</p>
              <p className="text-sm text-ink-soft">
                Every church starts with a <b>14-day free trial</b>. No card
                needed to begin.
              </p>

              <div className="space-y-2.5">
                {PLANS.map((p) => {
                  const on = plan === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPlan(p.id)}
                      className={`w-full rounded-xl border p-4 text-left transition ${
                        on
                          ? "border-brand bg-brand-soft/40 ring-1 ring-brand"
                          : "border-line hover:bg-surface-2"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-ink">{p.name}</div>
                          <div className="text-xs text-ink-soft">{p.blurb}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-bold text-ink">{p.price}</div>
                          <div className="text-[11px] text-ink-soft">
                            {p.cadence}
                          </div>
                        </div>
                      </div>
                      <ul className="mt-2.5 space-y-1">
                        {p.features.map((f) => (
                          <li
                            key={f}
                            className="flex items-start gap-1.5 text-xs text-ink-soft"
                          >
                            <Check
                              size={12}
                              className="mt-0.5 shrink-0 text-brand"
                            />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>

              {error && <p className="text-sm text-danger">{error}</p>}

              <button
                onClick={create}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
              >
                {busy && <Loader2 size={15} className="animate-spin" />}
                Start free trial
              </button>
              <p className="text-center text-xs text-ink-soft">
                Billing is in test mode — no payment is collected yet.
              </p>
            </div>
          )}
        </div>

        <button
          onClick={signOut}
          className="mx-auto mt-4 flex items-center gap-1.5 text-xs text-white/70 hover:text-white"
        >
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-xs font-semibold text-ink-soft hover:text-brand"
    >
      <ArrowLeft size={13} /> Back
    </button>
  );
}
