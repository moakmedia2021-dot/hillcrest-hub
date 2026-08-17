"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/PageHeader";
import { getSupabase } from "@/lib/supabase/client";
import {
  platformOverview,
  createDemoChurch,
  demoSwitchChurch,
  deleteDemoChurch,
  demoSetMyRole,
  type PlatformOverview,
} from "@/lib/supabase/data";
import { ROLE_LABEL, type Role } from "@/lib/types";
import {
  FlaskConical,
  Plus,
  Loader2,
  LogIn,
  Trash2,
  Eye,
  RefreshCw,
  ShieldAlert,
  Check,
} from "lucide-react";

const ROLES: Role[] = ["admin", "pastor", "lead", "volunteer"];

export default function DemoPage() {
  const { user, previewRole, setPreview, realRole, refreshUser } = useAuth();
  const { refresh } = useStore();
  const router = useRouter();

  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [name, setName] = useState("Demo Community Church");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    const res = await platformOverview(sb);
    if (res.data) setOverview(res.data);
  }, []);

  useEffect(() => {
    if (user && !user.platformAdmin) router.replace("/dashboard");
  }, [user, router]);

  useEffect(() => {
    if (user?.platformAdmin) load();
  }, [user?.platformAdmin, load]);

  if (!user?.platformAdmin) return null;

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 5000);
  };

  const run = async (
    key: string,
    fn: () => Promise<{ error?: string }>,
    after?: string,
  ) => {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    if (res.error) return flash(res.error);
    await load();
    await refreshUser();
    refresh();
    if (after) flash(after);
  };

  const sb = getSupabase();
  // Filter on the flag, not the name — a demo church can be called anything.
  const demoOrgs = (overview?.orgs ?? []).filter((o) => o.is_demo);
  const myOrgId = user.orgId;

  return (
    <>
      <PageHeader
        eyebrow="Internal · Platform"
        title="Demo Mode"
        subtitle="Spin up fake churches and walk the product as any role."
        action={
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-surface-2"
          >
            <RefreshCw size={15} /> Refresh
          </button>
        }
      />

      <div className="space-y-6 p-4 sm:p-8">
        {msg && (
          <p className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-medium text-brand-dark">
            {msg}
          </p>
        )}

        {/* Role preview */}
        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="flex items-center gap-2 font-bold text-ink">
              <Eye size={16} className="text-brand" /> Preview as a role
            </h2>
            <p className="text-xs text-ink-soft">
              Changes what the menu and pages show, instantly. Your real role
              stays {realRole ? ROLE_LABEL[realRole] : "unchanged"}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 p-5">
            <button
              onClick={() => setPreview(null)}
              className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                !previewRole
                  ? "border-brand bg-brand text-white"
                  : "border-line text-ink-soft hover:bg-surface-2"
              }`}
            >
              My real role
            </button>
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => setPreview(r)}
                className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                  previewRole === r
                    ? "border-brand bg-brand text-white"
                    : "border-line text-ink-soft hover:bg-surface-2"
                }`}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
            <button
              onClick={() => setPreview("lead", true)}
              className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                previewRole === "lead" && user.isStaff
                  ? "border-brand bg-brand text-white"
                  : "border-line text-ink-soft hover:bg-surface-2"
              }`}
            >
              Lead + Staff
            </button>
          </div>
          <p className="border-t border-line bg-surface-2 px-5 py-3 text-xs text-ink-soft">
            This is a <b>UI preview</b>. The database still applies your real
            permissions, so writes behave as your actual role. To test
            permissions for real, switch your role inside a demo church below.
          </p>
        </section>

        {/* Real role switching inside a demo church */}
        {demoOrgs.some((o) => o.id === myOrgId) && (
          <section className="card overflow-hidden ring-2 ring-brand/30">
            <div className="border-b border-line px-5 py-3.5">
              <h2 className="font-bold text-ink">
                Change my real role in this demo church
              </h2>
              <p className="text-xs text-ink-soft">
                Actually changes your role in the database, so permissions and
                writes behave exactly as that role would.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 p-5">
              {ROLES.map((r) => (
                <button
                  key={r}
                  onClick={() =>
                    sb &&
                    run(
                      "role" + r,
                      () => demoSetMyRole(sb, r),
                      `You are now ${ROLE_LABEL[r]} in this demo church.`,
                    )
                  }
                  disabled={busy === "role" + r}
                  className="flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface-2 disabled:opacity-50"
                >
                  {busy === "role" + r && (
                    <Loader2 size={14} className="animate-spin" />
                  )}
                  {realRole === r && <Check size={14} className="text-brand" />}
                  Become {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Create a demo church */}
        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="flex items-center gap-2 font-bold text-ink">
              <FlaskConical size={16} className="text-brand" /> Create a demo
              church
            </h2>
            <p className="text-xs text-ink-soft">
              Fully populated: ministries, chats, eight fake volunteers, a
              roster, an event and a staff meeting.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 p-5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Demo Community Church"
              className="min-w-[14rem] flex-1 rounded-lg border border-line bg-surface px-3 py-2.5 text-base outline-none focus:border-brand sm:text-sm"
            />
            <button
              onClick={() =>
                sb &&
                run(
                  "create",
                  () => createDemoChurch(sb, name.trim() || "Demo Church"),
                  "Demo church created.",
                )
              }
              disabled={busy === "create"}
              className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {busy === "create" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Plus size={15} />
              )}
              Create
            </button>
          </div>
        </section>

        {/* Demo churches */}
        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="font-bold text-ink">Demo churches</h2>
            <p className="text-xs text-ink-soft">
              Jump into one to experience the app exactly as that church.
            </p>
          </div>
          {demoOrgs.length === 0 ? (
            <p className="p-5 text-sm text-ink-soft">
              None yet — create one above.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {demoOrgs.map((o) => {
                const here = o.id === myOrgId;
                return (
                  <li
                    key={o.id}
                    className="flex flex-wrap items-center gap-3 px-5 py-3.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-ink">
                          {o.name}
                        </span>
                        {here && (
                          <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold uppercase text-brand-dark">
                            You&apos;re here
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-xs text-ink-soft">
                        {o.invite_code} · {o.members} members · {o.plan} ·{" "}
                        {o.status}
                      </div>
                    </div>
                    {!here && (
                      <button
                        onClick={() =>
                          sb &&
                          run(
                            "switch" + o.id,
                            () => demoSwitchChurch(sb, o.id),
                            `You're now inside ${o.name}.`,
                          )
                        }
                        disabled={busy === "switch" + o.id}
                        className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
                      >
                        {busy === "switch" + o.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <LogIn size={14} />
                        )}
                        Enter
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (!sb) return;
                        if (
                          confirm(
                            `Delete "${o.name}" and all its demo data? This can't be undone.`,
                          )
                        )
                          run(
                            "del" + o.id,
                            () => deleteDemoChurch(sb, o.id),
                            "Demo church deleted.",
                          );
                      }}
                      disabled={busy === "del" + o.id}
                      className="rounded-lg border border-line p-2 text-ink-soft hover:bg-red-50 hover:text-danger disabled:opacity-50"
                      title="Delete demo church"
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <ShieldAlert size={17} className="mt-0.5 shrink-0" />
          <p>
            Demo churches are fully isolated from real ones, and only the
            platform team can create, enter, or delete them. Switching churches
            moves your account — use <b>Enter</b> on your real church to go
            back.
          </p>
        </div>
      </div>
    </>
  );
}
