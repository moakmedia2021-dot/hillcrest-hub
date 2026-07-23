# Hillcrest Hub

A team workspace for the Hillcrest creative team and church volunteers — chat &
announcements, a social-media production schedule, a team directory, and
role-based admin controls. Built to grow into Planning Center, OneDrive, team
email, and SMS reminders.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 ·
lucide-react. Deploys free on Vercel.

---

## Running locally

```bash
npm install
npm run dev
# open http://localhost:3000  (this repo runs on :3002 via the preview config)
```

Pick any profile on the sign-in screen. Each role sees different permissions.

---

## How it's built (important)

Everything the UI needs flows through **one demo data layer**:

- `lib/store.tsx` — all data (members, channels, messages, tasks) + the actions
  that change it. Persists to `localStorage` today.
- `lib/auth.tsx` — who's signed in, and `can(permission)` checks.
- `lib/types.ts` — the domain model **and the role→permission matrix**
  (`ROLE_PERMISSIONS`). This is the single source of truth for access.
- `lib/seed.ts` — the realistic starter data you see on first load.

This means the UI is already done and correct. **Going live = swapping the
insides of `store.tsx` and `auth.tsx` for Supabase, without touching any page or
component.**

### Roles & permissions

| Role       | Manage users | Post announcements | Manage schedule | Create channels | Admin area |
| ---------- | :----------: | :----------------: | :-------------: | :-------------: | :--------: |
| Admin      |      ✓       |         ✓          |        ✓        |        ✓        |     ✓      |
| Pastor     |              |         ✓          |        ✓        |        ✓        |     ✓      |
| Team Lead  |              |                    |        ✓        |                 |            |
| Volunteer  |              |                    |                 |                 |            |

Edit `ROLE_PERMISSIONS` in `lib/types.ts` to change what any role can do.

---

## Feature status

**Phase 1 — built & working**

- [x] Sign-in with role selection (Admin / Pastor / Team Lead / Volunteer)
- [x] Role-based permissions + guarded routes
- [x] Chat: announcement broadcast + team/department channels, membership-scoped
- [x] Production schedule: kanban (Ideas → Filming → Editing → Review →
      Scheduled → Posted), assignees, due dates, platforms, create/move/delete
- [x] Dashboard: stats, pinned announcement, my tasks, deadlines, activity
- [x] Team directory grouped by department
- [x] Admin: change roles live + permission matrix
- [x] Responsive (desktop + phone) + installable PWA shell

**Phase 2 — built**

- [x] Event planning templates + central hub (checklists with auto due dates)
- [x] Real auth + database (Supabase) — env-gated, see below
- [x] Planning Center (PCO) integration — people + upcoming service plans

**Phase 3 — planned (stubbed in the sidebar as "Soon")**

- [ ] Push / reminder notifications (web push)
- [ ] OneDrive file integration (Microsoft Graph)
- [ ] Team email (Resend / Postmark)
- [ ] Mass SMS reminders (Twilio — the one piece that requires paid service)

## Planning Center

Server route `app/api/pco/route.ts` proxies PCO with server-only credentials
(`PCO_APP_ID` / `PCO_SECRET`) so keys never reach the browser. The
`/planning-center` page shows a setup guide until credentials are added, then
lists your active people and upcoming service plans. To connect: generate a
Personal Access Token at planningcenteronline.com, add the two vars to
`.env.local` (and Vercel), and restart. Extend `route.ts` to pull teams,
schedules, or check-ins as needed.

---

## Going live with Supabase (already wired — just activate)

The Supabase integration is built. The app auto-switches from demo → live the
moment both env vars are present. Steps:

1. Create a free project at **supabase.com**.
2. In the Supabase **SQL Editor**, paste and run **`supabase/schema.sql`**
   (creates tables, roles, the profile-on-signup trigger, Row Level Security,
   and realtime).
3. Copy `.env.example` → `.env.local` and fill in from Supabase
   **Project Settings → API**:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
4. Restart `npm run dev`. The sign-in screen is now a real **email/password**
   form instead of the demo picker.
5. Sign up your own account, then in the SQL Editor make yourself admin:
   ```sql
   update profiles set role = 'admin' where email = 'you@example.com';
   ```
6. Deploy to Vercel and add the same two env vars there.

**How the switch works:** `lib/supabase/config.ts` exposes `SUPABASE_ENABLED`.
When off, `lib/store.tsx` uses localStorage and `lib/auth.tsx` uses the demo
picker (verified working). When on, the store loads from Supabase +
subscribes to realtime and writes through `lib/supabase/data.ts`, and auth uses
real Supabase sessions. **No page or component changes either way.** The RLS
policies enforce the same role rules as the in-app permission matrix, so
security holds even if someone hits the API directly.

> Note: the live Supabase path is written and type-checked but can only be
> fully exercised against a real project — test it end-to-end after step 5.
