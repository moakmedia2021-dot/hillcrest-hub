"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Clock, LogOut } from "lucide-react";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, ready, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) router.replace("/");
  }, [ready, user, router]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />
      </div>
    );
  }

  // New accounts wait for an admin to approve them.
  if (user.approved === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand to-brand-dark px-4">
        <div className="card max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-dark">
            <Clock size={26} />
          </div>
          <h1 className="text-xl font-bold text-ink">You&apos;re almost in!</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Thanks for signing up, {user.name.split(" ")[0]}. A Hillcrest admin
            needs to approve your account before you can join. You&apos;ll get
            access as soon as they do.
          </p>
          <button
            onClick={() => {
              signOut();
              router.push("/");
            }}
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink-soft hover:bg-surface-2"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
