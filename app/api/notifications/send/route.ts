// Delivers queued notifications as web push and/or email.
//
// Credentials are server-only and everything degrades gracefully: with no keys
// set the route reports what's missing instead of failing, and the in-app bell
// keeps working regardless.
//
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY  → web push   (npx web-push generate-vapid-keys)
//   RESEND_API_KEY / NOTIFY_FROM_EMAIL    → email
//   SUPABASE_SERVICE_ROLE_KEY             → read the outbox server-side

import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const RESEND_KEY = process.env.RESEND_API_KEY ?? "";
const FROM = process.env.NOTIFY_FROM_EMAIL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const pushReady = Boolean(VAPID_PUBLIC && VAPID_PRIVATE);
if (pushReady) {
  webpush.setVapidDetails(
    FROM ? `mailto:${FROM}` : "mailto:admin@example.com",
    VAPID_PUBLIC,
    VAPID_PRIVATE
  );
}

async function sendEmail(to: string, subject: string, text: string) {
  if (!RESEND_KEY || !FROM) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, text }),
  });
  return res.ok;
}

export async function POST() {
  if (!SERVICE_KEY || !SUPABASE_URL) {
    return Response.json(
      {
        ok: false,
        reason:
          "Set SUPABASE_SERVICE_ROLE_KEY (and Supabase URL) so the sender can read the outbox.",
      },
      { status: 200 }
    );
  }

  // Service role: this runs server-side only and must read across members.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data: queued, error } = await admin
    .from("notifications")
    .select("*")
    .or("sent_push.eq.false,sent_email.eq.false")
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) return Response.json({ ok: false, reason: error.message });
  if (!queued?.length) return Response.json({ ok: true, sent: 0 });

  let pushed = 0;
  let emailed = 0;

  for (const n of queued) {
    const { data: profile } = await admin
      .from("profiles")
      .select("email, notify_push, notify_email")
      .eq("id", n.member_id)
      .single();
    if (!profile) continue;

    // Web push to every device this person allowed.
    if (pushReady && profile.notify_push && !n.sent_push) {
      const { data: subs } = await admin
        .from("push_subscriptions")
        .select("*")
        .eq("member_id", n.member_id);

      for (const s of subs ?? []) {
        try {
          await webpush.sendNotification(
            {
              endpoint: s.endpoint,
              keys: { p256dh: s.p256dh, auth: s.auth },
            },
            JSON.stringify({
              title: n.title,
              body: n.body ?? "",
              href: n.href ?? "/dashboard",
              tag: n.kind,
            })
          );
          pushed++;
        } catch (err) {
          // 404/410 means the device unsubscribed — clean it up.
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            await admin.from("push_subscriptions").delete().eq("id", s.id);
          }
        }
      }
      await admin
        .from("notifications")
        .update({ sent_push: true })
        .eq("id", n.id);
    }

    if (profile.notify_email && !n.sent_email && profile.email) {
      const ok = await sendEmail(
        profile.email,
        n.title,
        `${n.body ?? ""}\n\nOpen: ${
          process.env.NEXT_PUBLIC_SITE_URL ?? "https://hillcrest-hub.vercel.app"
        }${n.href ?? "/dashboard"}`
      );
      if (ok) emailed++;
      await admin
        .from("notifications")
        .update({ sent_email: true })
        .eq("id", n.id);
    }
  }

  return Response.json({
    ok: true,
    queued: queued.length,
    pushed,
    emailed,
    pushConfigured: pushReady,
    emailConfigured: Boolean(RESEND_KEY && FROM),
  });
}

// Lets you check configuration from a browser.
export async function GET() {
  return Response.json({
    pushConfigured: pushReady,
    emailConfigured: Boolean(RESEND_KEY && FROM),
    outboxReadable: Boolean(SERVICE_KEY),
  });
}
