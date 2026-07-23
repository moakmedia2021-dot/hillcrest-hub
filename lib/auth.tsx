"use client";

// ─────────────────────────────────────────────
// Auth. Two modes behind one interface:
//  • Demo (default): pick a seeded member; session id in localStorage.
//  • Supabase (when configured): real email/password auth + profile lookup.
// Components only use useAuth(); they don't care which mode is active.
// ─────────────────────────────────────────────

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useStore } from "./store";
import { can as roleCan, type Member, type Permission, type Role } from "./types";
import { SUPABASE_ENABLED } from "./supabase/config";
import { getSupabase } from "./supabase/client";

const SESSION_KEY = "hillcrest-hub:session:v1";

interface AuthValue {
  user: Member | null;
  ready: boolean;
  enabled: boolean; // true when Supabase auth is live
  can: (perm: Permission) => boolean;
  signOut: () => void;
  // demo mode
  demoSignIn: (memberId: string) => void;
  // supabase mode
  signInWithPassword: (
    email: string,
    password: string
  ) => Promise<{ error?: string }>;
  signUp: (
    name: string,
    email: string,
    password: string
  ) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data } = useStore();
  const [ready, setReady] = useState(false);
  // demo: which seeded member id is "signed in"
  const [demoId, setDemoId] = useState<string | null>(null);
  // supabase: the fetched profile mapped to a Member
  const [profile, setProfile] = useState<Member | null>(null);

  useEffect(() => {
    const sb = SUPABASE_ENABLED ? getSupabase() : null;
    if (!sb) {
      setDemoId(window.localStorage.getItem(SESSION_KEY));
      setReady(true);
      return;
    }

    const loadProfile = async (userId: string) => {
      const { data: p } = await sb
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      setProfile(p ? mapProfile(p) : null);
    };

    sb.auth.getSession().then(({ data: { session } }) => {
      if (session) loadProfile(session.user.id);
      setReady(true);
    });

    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      if (session) loadProfile(session.user.id);
      else setProfile(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const user: Member | null = SUPABASE_ENABLED
    ? profile
    : data.members.find((m) => m.id === demoId) ?? null;

  const value: AuthValue = {
    user,
    ready,
    enabled: SUPABASE_ENABLED,
    can: (perm) => (user ? roleCan(user.role, perm) : false),
    signOut: () => {
      if (SUPABASE_ENABLED) {
        getSupabase()?.auth.signOut();
        setProfile(null);
      } else {
        window.localStorage.removeItem(SESSION_KEY);
        setDemoId(null);
      }
    },
    demoSignIn: (memberId) => {
      window.localStorage.setItem(SESSION_KEY, memberId);
      setDemoId(memberId);
    },
    signInWithPassword: async (email, password) => {
      const sb = getSupabase();
      if (!sb) return { error: "Supabase not configured" };
      const { error } = await sb.auth.signInWithPassword({ email, password });
      return { error: error?.message };
    },
    signUp: async (name, email, password) => {
      const sb = getSupabase();
      if (!sb) return { error: "Supabase not configured" };
      const { error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      return { error: error?.message };
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function mapProfile(p: Record<string, unknown>): Member {
  return {
    id: p.id as string,
    name: (p.name as string) ?? "Member",
    role: (p.role as Role) ?? "volunteer",
    department: (p.department as string) ?? "Creative",
    title: (p.title as string) ?? undefined,
    email: (p.email as string) ?? "",
    phone: (p.phone as string) ?? undefined,
    avatarColor: (p.avatar_color as string) ?? "#12a6db",
    username: (p.username as string) ?? undefined,
    avatarUrl: (p.avatar_url as string) ?? undefined,
    bio: (p.bio as string) ?? undefined,
    approved: (p.approved as boolean) ?? true,
  };
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
