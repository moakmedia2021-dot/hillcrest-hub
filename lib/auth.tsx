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
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useStore } from "./store";
import { can as roleCan, type Member, type Permission, type Role } from "./types";
import { SUPABASE_ENABLED } from "./supabase/config";
import { getSupabase } from "./supabase/client";

const SESSION_KEY = "hillcrest-hub:session:v1";
const PREVIEW_KEY = "hillcrest-hub:preview-role:v1";

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
  // re-read the profile (after creating or joining a church)
  refreshUser: () => Promise<void>;
  // Demo mode: the platform team can preview the app as another role.
  // This changes what the UI shows; the database still enforces their real
  // permissions, so writes behave as their actual role.
  previewRole: Role | null;
  previewStaff: boolean;
  setPreview: (role: Role | null, staff?: boolean) => void;
  realRole: Role | null;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data } = useStore();
  const [ready, setReady] = useState(false);
  // demo: which seeded member id is "signed in"
  const [demoId, setDemoId] = useState<string | null>(null);
  // supabase: the fetched profile mapped to a Member
  const [profile, setProfile] = useState<Member | null>(null);
  // demo mode role preview
  const [previewRole, setPreviewRole] = useState<Role | null>(null);
  const [previewStaff, setPreviewStaff] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PREVIEW_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { role: Role | null; staff: boolean };
        setPreviewRole(p.role);
        setPreviewStaff(Boolean(p.staff));
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Which profile row is "me" — used by the realtime listener below.
  const profileIdRef = useRef<string | null>(null);

  const loadProfile = async (userId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    profileIdRef.current = userId;
    const { data: p } = await sb
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    setProfile(p ? mapProfile(p) : null);
  };

  const refreshUser = async () => {
    const sb = SUPABASE_ENABLED ? getSupabase() : null;
    if (!sb) return;
    const {
      data: { session },
    } = await sb.auth.getSession();
    if (session) await loadProfile(session.user.id);
  };

  useEffect(() => {
    const sb = SUPABASE_ENABLED ? getSupabase() : null;
    if (!sb) {
      setDemoId(window.localStorage.getItem(SESSION_KEY));
      setReady(true);
      return;
    }

    sb.auth.getSession().then(({ data: { session } }) => {
      if (session) loadProfile(session.user.id);
      setReady(true);
    });

    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      if (session) loadProfile(session.user.id);
      else setProfile(null);
    });

    // Your own row changing (role, staff access, approval, being removed)
    // should re-render your menus immediately, not on next reload.
    const selfChannel = sb
      .channel("my-profile")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          const row = payload.new as { id?: string };
          if (row?.id && row.id === profileIdRef.current) loadProfile(row.id);
        }
      )
      .subscribe();

    // And re-check when you come back to the tab.
    const onWake = () => {
      if (document.visibilityState === "visible" && profileIdRef.current)
        loadProfile(profileIdRef.current);
    };
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);

    return () => {
      sub.subscription.unsubscribe();
      sb.removeChannel(selfChannel);
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, []);

  const realUser: Member | null = SUPABASE_ENABLED
    ? profile
    : data.members.find((m) => m.id === demoId) ?? null;

  // Only the platform team can preview another role, and only for the UI —
  // the database still applies their real permissions.
  const previewing = Boolean(realUser?.platformAdmin && previewRole);
  const user: Member | null = previewing
    ? { ...realUser!, role: previewRole!, isStaff: previewStaff }
    : realUser;

  const value: AuthValue = {
    user,
    ready,
    enabled: SUPABASE_ENABLED,
    can: (perm) =>
      user ? roleCan(user.role, perm, user.isStaff) : false,
    previewRole: previewing ? previewRole : null,
    previewStaff,
    realRole: realUser?.role ?? null,
    setPreview: (role, staff) => {
      const s = staff ?? (role === "admin" || role === "pastor");
      setPreviewRole(role);
      setPreviewStaff(s);
      try {
        if (role)
          window.localStorage.setItem(
            PREVIEW_KEY,
            JSON.stringify({ role, staff: s })
          );
        else window.localStorage.removeItem(PREVIEW_KEY);
      } catch {
        /* ignore */
      }
    },
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
    refreshUser,
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
    orgId: (p.org_id as string) ?? undefined,
    platformAdmin: (p.platform_admin as boolean) ?? false,
    isStaff: (p.is_staff as boolean) ?? false,
    removed: (p.removed as boolean) ?? false,
  };
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
