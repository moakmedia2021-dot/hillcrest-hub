"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { Loader2, ArrowLeft, Check } from "lucide-react";

export default function SignUpPage() {
  const { user, ready, enabled, signUp } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (ready && user) router.replace("/dashboard");
  }, [ready, user, router]);

  const field =
    "w-full rounded-lg border border-line bg-surface px-3.5 py-3 text-base outline-none focus:border-brand sm:text-sm";

  const submit = async () => {
    if (!name.trim() || !email.trim() || password.length < 6) return;
    setBusy(true);
    setError(null);
    const res = await signUp(name.trim(), email.trim(), password);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setNotice(
      "Account created. If your church uses email confirmation, check your inbox — otherwise sign in to continue."
    );
  };

  return (
    <div className="hh-hero flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Logo className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold sm:text-3xl">Create your account</h1>
          <p className="mt-1 text-sm text-white/80">
            Then start a church or join your team with an invite code.
          </p>
        </div>

        <div className="card p-5 shadow-xl sm:p-6">
          {!enabled ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-ink-soft">
                Sign-up needs the live database. This preview is running in demo
                mode.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-dark"
              >
                <ArrowLeft size={14} /> Back to sign in
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-soft">
                  Full name
                </label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Malachi Moak"
                  className={field}
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-soft">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@church.org"
                  className={field}
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-soft">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="At least 6 characters"
                  className={field}
                  autoComplete="new-password"
                />
              </div>

              {error && <p className="text-sm text-danger">{error}</p>}
              {notice && (
                <p className="flex items-start gap-2 rounded-lg bg-brand-soft px-3 py-2.5 text-sm text-brand-dark">
                  <Check size={15} className="mt-0.5 shrink-0" />
                  {notice}
                </p>
              )}

              <button
                onClick={submit}
                disabled={
                  busy || !name.trim() || !email.trim() || password.length < 6
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-40"
              >
                {busy && <Loader2 size={16} className="animate-spin" />}
                Create account
              </button>

              <p className="pt-1 text-center text-sm text-ink-soft">
                Already have an account?{" "}
                <Link
                  href="/"
                  className="font-semibold text-brand hover:text-brand-dark"
                >
                  Sign in
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
