// Server-side Planning Center proxy. Credentials (PCO_APP_ID / PCO_SECRET) stay
// on the server and never reach the browser. Each PCO product is fetched
// independently so a permission gap in one (e.g. People) doesn't break the
// others (e.g. Services). Returns { connected:false } when creds are absent.

export const dynamic = "force-dynamic"; // always live, never cached

const PCO = "https://api.planningcenteronline.com";

interface PcoPerson {
  id: string;
  name: string;
  status?: string;
}
interface PcoPlan {
  id: string;
  title: string;
  date: string;
  serviceType: string;
}

async function pcoGet(path: string, auth: string) {
  const res = await fetch(`${PCO}${path}`, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const reason =
      res.status === 403
        ? "Your PCO account doesn't have permission for this product."
        : res.status === 401
          ? "This product isn't enabled for the token."
          : `Request failed (${res.status}).`;
    const err = new Error(reason);
    (err as { status?: number }).status = res.status;
    throw err;
  }
  return res.json();
}

export async function GET() {
  const appId = process.env.PCO_APP_ID;
  const secret = process.env.PCO_SECRET;

  if (!appId || !secret) {
    return Response.json({ connected: false });
  }

  const auth = Buffer.from(`${appId}:${secret}`).toString("base64");

  // Confirm the token is valid at all (and grab who it belongs to).
  let identity: string | null = null;
  try {
    const me = await pcoGet("/people/v2/me", auth);
    identity = me.data?.attributes?.name ?? null;
  } catch {
    return Response.json({
      connected: false,
      error: "Token rejected by Planning Center. Double-check the App ID and Secret.",
    });
  }

  // ── People (independent) ──
  let people: PcoPerson[] = [];
  let peopleCount = 0;
  let peopleError: string | null = null;
  try {
    const res = await pcoGet(
      "/people/v2/people?per_page=50&order=last_name",
      auth
    );
    people = (res.data ?? []).map(
      (p: { id: string; attributes: Record<string, string> }) => ({
        id: p.id,
        name: p.attributes.name,
        status: p.attributes.status,
      })
    );
    peopleCount = res.meta?.total_count ?? people.length;
  } catch (err) {
    peopleError = err instanceof Error ? err.message : "People unavailable.";
  }

  // ── Services / upcoming plans (independent) ──
  let plans: PcoPlan[] = [];
  let plansError: string | null = null;
  try {
    const typesRes = await pcoGet("/services/v2/service_types", auth);
    const serviceTypes: { id: string; name: string }[] = (typesRes.data ?? [])
      .slice(0, 4)
      .map((t: { id: string; attributes: { name: string } }) => ({
        id: t.id,
        name: t.attributes.name,
      }));

    const planLists = await Promise.all(
      serviceTypes.map(async (st) => {
        const res = await pcoGet(
          `/services/v2/service_types/${st.id}/plans?filter=future&per_page=5&order=sort_date`,
          auth
        );
        return (res.data ?? []).map(
          (pl: { id: string; attributes: Record<string, string> }) => ({
            id: pl.id,
            title:
              pl.attributes.title || pl.attributes.dates || "Untitled plan",
            date: pl.attributes.sort_date ?? pl.attributes.dates ?? "",
            serviceType: st.name,
          })
        );
      })
    );
    plans = planLists
      .flat()
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .slice(0, 12);
  } catch (err) {
    plansError = err instanceof Error ? err.message : "Services unavailable.";
  }

  return Response.json({
    connected: true,
    identity,
    people,
    peopleCount,
    peopleError,
    plans,
    plansError,
  });
}
