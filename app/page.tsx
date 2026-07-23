"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { Avatar, RoleBadge } from "@/components/Avatar";
import { ArrowRight, Loader2 } from "lucide-react";

export default function LoginPage() {
  const { user, ready, enabled } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && user) router.replace("/dashboard");
  }, [ready, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand to-brand-dark px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-2xl font-bold backdrop-blur">
            H
          </div>
          <h1 className="text-2xl font-bold">Hillcrest Hub</h1>
          <p className="mt-1 text-sm text-white/80">
            The workspace for our creative team &amp; volunteers.
          </p>
        </div>

        {enabled ? <SupabaseAuth /> : <DemoPicker />}
      </div>
    </div>
  );
}

function DemoPicker() {
  const { demoSignIn } = useAuth();
  const { data } = useStore();
  const router = useRouter();

  return (
    <>
      <div className="card p-5 shadow-xl">
        <p className="eyebrow mb-1">Demo sign in</p>
        <h2 className="mb-1 text-lg font-bold text-ink">Who are you?</h2>
        <p className="mb-4 text-sm text-ink-soft">
          Pick a profile to explore. Each role sees different permissions.
        </p>

        <div className="space-y-2">
          {data.members.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                demoSignIn(m.id);
                router.push("/dashboard");
              }}
              className="group flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-left transition hover:border-brand hover:bg-brand-soft/40"
            >
              <Avatar member={m} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">
                  {m.name}
                </div>
                <div className="truncate text-xs text-ink-soft">
                  {m.title} · {m.department}
                </div>
              </div>
              <RoleBadge role={m.role} />
              <ArrowRight
                size={16}
                className="text-ink-soft/40 transition group-hover:translate-x-0.5 group-hover:text-brand"
              />
            </button>
          ))}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-white/70">
        Demo mode · data stays in your browser. Add Supabase keys to go live.
      </p>
    </>
  );
}

function SupabaseAuth() {
  const { signInWithPassword, signUp } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const field =
    "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand";

  const submit = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const res =
      mode === "in"
        ? await signInWithPassword(email, password)
        : await signUp(name, email, password);
    setBusy(false);
    if (res.error) {
      setError(res.error);
    } else if (mode === "up") {
      setNotice("Account created. Check your email to confirm, then sign in.");
      setMode("in");
    }
    // On successful sign-in, the auth listener redirects via the effect above.
  };

  return (
    <div className="card p-5 shadow-xl">
      <p className="eyebrow mb-1">{mode === "in" ? "Sign in" : "Create account"}</p>
      <h2 className="mb-4 text-lg font-bold text-ink">
        {mode === "in" ? "Welcome back" : "Join the team"}
      </h2>

      <div className="space-y-3">
        {mode === "up" && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className={field}
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className={field}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Password"
          className={field}
        />

        {error && <p className="text-sm text-danger">{error}</p>}
        {notice && <p className="text-sm text-ok">{notice}</p>}

        <button
          onClick={submit}
          disabled={busy || !email || !password}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-40"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          {mode === "in" ? "Sign in" : "Create account"}
        </button>
      </div>

      <button
        onClick={() => {
          setMode(mode === "in" ? "up" : "in");
          setError(null);
          setNotice(null);
        }}
        className="mt-4 w-full text-center text-sm text-ink-soft hover:text-brand"
      >
        {mode === "in"
          ? "Need an account? Sign up"
          : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
