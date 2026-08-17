"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase/client";
import { completeSetup, skipSetup } from "@/lib/supabase/data";
import { DEPARTMENT_SUGGESTIONS } from "@/lib/departments";
import { Logo } from "./Logo";
import { Check, Loader2, Plus, Sparkles, X } from "lucide-react";

// Shown once, to the admin of a brand-new church, so they don't land in an
// empty app. Builds their ministries, a chat for each, and starter resources.
export function SetupWizard({ onDone }: { onDone: () => void }) {
  const { data } = useStore();
  const { user } = useAuth();
  const [picked, setPicked] = useState<Set<string>>(
    new Set(["Leadership", "Worship", "Kids"])
  );
  const [custom, setCustom] = useState("");
  const [extras, setExtras] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = [...DEPARTMENT_SUGGESTIONS, ...extras];

  const toggle = (name: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });

  const addCustom = () => {
    const clean = custom.trim();
    if (!clean) return;
    if (!options.includes(clean)) setExtras((e) => [...e, clean]);
    setPicked((s) => new Set(s).add(clean));
    setCustom("");
  };

  const finish = async () => {
    const sb = getSupabase();
    if (!sb) return onDone();
    setBusy(true);
    setError(null);
    const res = await completeSetup(sb, Array.from(picked));
    setBusy(false);
    if (res.error) return setError(res.error);
    onDone();
  };

  const skip = async () => {
    const sb = getSupabase();
    if (!sb) return onDone();
    setBusy(true);
    await skipSetup(sb);
    setBusy(false);
    onDone();
  };

  return (
    <div className="hh-hero min-h-screen px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Logo className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold sm:text-3xl">
            Let&apos;s set up {data.org?.name ?? "your church"}
          </h1>
          <p className="mx-auto mt-1 max-w-md text-sm text-white/80">
            Pick the ministries you have. We&apos;ll create a team chat for
            each one and get your workspace ready.
          </p>
        </div>

        <div className="card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles size={16} className="text-brand" />
            <h2 className="font-bold text-ink">Your ministries</h2>
            <span className="ml-auto text-xs text-ink-soft">
              {picked.size} selected
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {options.map((name) => {
              const on = picked.has(name);
              return (
                <button
                  key={name}
                  onClick={() => toggle(name)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                    on
                      ? "border-brand bg-brand-soft/50 font-semibold text-ink"
                      : "border-line text-ink-soft hover:bg-surface-2"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${
                      on ? "border-brand bg-brand text-white" : "border-line"
                    }`}
                  >
                    {on && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span className="truncate">{name}</span>
                </button>
              );
            })}
          </div>

          {/* Add your own */}
          <div className="mt-4 flex gap-2">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustom()}
              placeholder="Add another ministry…"
              className="flex-1 rounded-lg border border-line bg-surface px-3 py-2.5 text-base outline-none focus:border-brand sm:text-sm"
            />
            <button
              onClick={addCustom}
              disabled={!custom.trim()}
              className="flex items-center gap-1.5 rounded-lg border border-line px-3.5 text-sm font-semibold text-ink-soft hover:bg-surface-2 disabled:opacity-40"
            >
              <Plus size={15} /> Add
            </button>
          </div>

          {/* What happens */}
          <div className="mt-5 rounded-xl bg-surface-2 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
              We&apos;ll create
            </p>
            <ul className="space-y-1.5 text-sm text-ink-soft">
              <li className="flex items-start gap-2">
                <Check size={14} className="mt-0.5 shrink-0 text-brand" />
                {picked.size} ministr{picked.size === 1 ? "y" : "ies"}, each
                with its own team chat
              </li>
              <li className="flex items-start gap-2">
                <Check size={14} className="mt-0.5 shrink-0 text-brand" />
                A starter resources library for your volunteers
              </li>
              <li className="flex items-start gap-2">
                <Check size={14} className="mt-0.5 shrink-0 text-brand" />
                Your invite code, ready to share with your team
              </li>
            </ul>
          </div>

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
            <button
              onClick={skip}
              disabled={busy}
              className="flex-1 rounded-xl border border-line py-3 text-sm font-semibold text-ink-soft hover:bg-surface-2 disabled:opacity-50"
            >
              Skip for now
            </button>
            <button
              onClick={finish}
              disabled={busy || picked.size === 0}
              className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              Set up my church
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-white/70">
          You can add or change ministries any time in Admin.
        </p>
      </div>
    </div>
  );
}
