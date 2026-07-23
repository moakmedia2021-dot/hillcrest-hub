// Central switch: the app runs in demo mode until BOTH Supabase env vars are
// present, at which point auth + data go live. Next inlines NEXT_PUBLIC_* at
// build time, so this evaluates correctly on both server and client.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
