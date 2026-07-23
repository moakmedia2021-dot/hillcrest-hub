"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  FolderSync,
  RefreshCw,
  CalendarDays,
  Users,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

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
interface PcoResponse {
  connected: boolean;
  error?: string;
  identity?: string | null;
  people?: PcoPerson[];
  peopleCount?: number;
  peopleError?: string | null;
  plans?: PcoPlan[];
  plansError?: string | null;
}

export default function PlanningCenterPage() {
  const [data, setData] = useState<PcoResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pco");
      setData(await res.json());
    } catch {
      setData({ connected: true, error: "Could not reach the server." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageHeader
        eyebrow="Integration"
        title="Planning Center"
        subtitle="Pull your people and upcoming service plans straight from PCO."
        action={
          data?.connected && (
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-surface-2 disabled:opacity-50"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          )
        }
      />

      <div className="p-5 sm:p-8">
        {loading && !data ? (
          <div className="flex items-center gap-2 text-ink-soft">
            <RefreshCw size={16} className="animate-spin" /> Connecting…
          </div>
        ) : !data?.connected ? (
          <NotConnected />
        ) : (
          <Connected data={data} />
        )}
      </div>
    </>
  );
}

function NotConnected() {
  const steps = [
    "Sign in at api.planningcenteronline.com and open Developers → Personal Access Tokens.",
    "Create a token. Copy the Application ID and Secret.",
    "Add PCO_APP_ID and PCO_SECRET to your .env.local (and Vercel).",
    "Restart the app and refresh this page.",
  ];
  return (
    <div className="mx-auto max-w-xl">
      <div className="card p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-dark">
          <FolderSync size={26} />
        </div>
        <h2 className="text-xl font-bold text-ink">Connect Planning Center</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
          Add a Planning Center Personal Access Token to sync your people and
          service plans. Your credentials stay on the server — never in the
          browser.
        </p>

        <ol className="mx-auto mt-6 max-w-md space-y-3 text-left">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                {i + 1}
              </span>
              <span className="text-sm text-ink">{s}</span>
            </li>
          ))}
        </ol>

        <a
          href="https://api.planningcenteronline.com/oauth/applications"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Open Planning Center <ExternalLink size={15} />
        </a>
      </div>
    </div>
  );
}

function Connected({ data }: { data: PcoResponse }) {
  const plans = data.plans ?? [];
  const people = data.people ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-ok">
        <CheckCircle2 size={16} /> Connected to Planning Center
        {data.identity && (
          <span className="font-normal text-ink-soft">as {data.identity}</span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming plans */}
        <section className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
            <CalendarDays size={16} className="text-brand" />
            <h2 className="font-bold text-ink">Upcoming service plans</h2>
          </div>
          {data.plansError ? (
            <ProductNote message={data.plansError} product="Services" />
          ) : plans.length === 0 ? (
            <p className="p-5 text-sm text-ink-soft">No upcoming plans found.</p>
          ) : (
            <ul className="divide-y divide-line">
              {plans.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">
                      {p.title}
                    </div>
                    <div className="text-xs text-ink-soft">{p.serviceType}</div>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-brand">
                    {p.date
                      ? new Date(p.date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* People */}
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-brand" />
              <h2 className="font-bold text-ink">People</h2>
            </div>
            {!data.peopleError && (
              <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-dark">
                {data.peopleCount ?? people.length} total
              </span>
            )}
          </div>
          {data.peopleError ? (
            <ProductNote message={data.peopleError} product="People" />
          ) : people.length === 0 ? (
            <p className="p-5 text-sm text-ink-soft">No people returned.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {people.map((p) => (
                <li key={p.id} className="px-5 py-2.5 text-sm text-ink">
                  {p.name}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function ProductNote({
  message,
  product,
}: {
  message: string;
  product: string;
}) {
  return (
    <div className="flex items-start gap-3 p-5">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warn" />
      <div>
        <p className="text-sm font-medium text-ink">{message}</p>
        <p className="mt-1 text-xs text-ink-soft">
          To enable {product}, an org admin can grant your PCO account access to
          the {product} product (Editor or higher), then hit Refresh.
        </p>
      </div>
    </div>
  );
}
