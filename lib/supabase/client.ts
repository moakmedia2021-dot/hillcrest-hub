"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_ENABLED, SUPABASE_URL } from "./config";
import type { SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

// Returns a singleton browser client, or null in demo mode.
export function getSupabase(): SupabaseClient | null {
  if (!SUPABASE_ENABLED) return null;
  if (!cached) {
    cached = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return cached;
}
