"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { authHeaders } from "@/lib/auth";
import { PageHeader } from "@/app/components/app/page-header";

type Bucket = { total: number; byApi: Record<string, number>; byFeature: Record<string, number> };

type GoogleDetails = {
  configured: boolean;
  services: string[];
  note: string;
  mapsNote: string;
  quotaLimit: number | null;
  quotaPercent: number | null;
  today: number;
  currentMonth: Bucket;
  previousMonth: Bucket;
  openhrm?: {
    autocomplete: number;
    placeDetails: number;
    geocode: number;
    reverseGeocode: number;
    total: number;
  };
  googleCloud?: {
    billableAutocomplete: number;
    billablePlaceDetails: number;
    actualUsage: null;
    actualCost: null;
    note: string;
  };
  trend: { day: string; count: number }[];
  recent: { api: string; feature: string; httpStatus: number; createdAt: string }[];
};

const API_LABELS: Record<string, string> = {
  places_autocomplete: "Address Autocomplete",
  place_details: "Place Details",
  geocode: "Geocoding",
  reverse_geocode: "Reverse Geocoding",
};

const FEATURE_LABELS: Record<string, string> = {
  branch: "Branch",
  site: "Task/Site",
  wfh: "WFH/Home",
};

function rows(map?: Record<string, number>, labels?: Record<string, string>) {
  return Object.entries(map || {})
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, label: labels?.[key] || key, count }));
}

export default function GoogleMapsApiPage() {
  const [data, setData] = useState<GoogleDetails | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/backend/external-apis/google-maps", { headers: authHeaders(), cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.message || "Could not load Google Maps usage");
        return body;
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message || "Could not load Google Maps usage");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const maxTrend = Math.max(1, ...(data?.trend || []).map((point) => point.count));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={MapPin}
        title="Google Maps"
        description="OpenHRM internal request counts. These are not Google Cloud invoices."
        actions={
          <Link href="/system-apis" className="text-sm text-primary underline">
            All APIs
          </Link>
        }
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Status" value={data.configured ? "Active" : "Not configured"} />
            <Stat label="Requests today" value={data.today.toLocaleString()} />
            <Stat label="This month" value={data.currentMonth.total.toLocaleString()} />
            <Stat label="Previous month" value={data.previousMonth.total.toLocaleString()} />
          </div>
          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 dark:border-border dark:bg-card">
            <h2 className="text-sm font-semibold">Provider</h2>
            <p className="mt-1 text-sm text-[#64748B]">Google · Places API (New) and Geocoding API on the server key</p>
            <h2 className="mt-4 text-sm font-semibold">Services enabled</h2>
            <ul className="mt-2 list-disc pl-5 text-sm text-[#334155]">
              {data.services.map((service) => (
                <li key={service}>{service}</li>
              ))}
              <li>Maps — browser map, only when a separate referrer-restricted key is set</li>
            </ul>
            <p className="mt-4 text-xs text-[#64748B]">{data.mapsNote}</p>
          </section>
          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 dark:border-border dark:bg-card">
            <h2 className="text-sm font-semibold">Quota</h2>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {data.quotaPercent != null ? `${data.quotaPercent}%` : "—"}
            </p>
            <p className="text-xs text-[#64748B]">
              {data.quotaLimit != null
                ? `${data.currentMonth.total.toLocaleString()} of ${data.quotaLimit.toLocaleString()} internal requests this month`
                : "Set GOOGLE_MAPS_MONTHLY_QUOTA to show a percentage"}
            </p>
            <p className="mt-3 text-xs text-[#64748B]">{data.note}</p>
          </section>
          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 dark:border-border dark:bg-card">
            <h2 className="text-sm font-semibold">Usage trend</h2>
            <p className="text-xs text-[#64748B]">Last 14 days, counted inside OpenHRM</p>
            <div className="mt-4 flex items-end gap-1 h-24">
              {data.trend.map((point) => (
                <div key={point.day} className="flex flex-1 flex-col items-center justify-end gap-1">
                  <div
                    className="w-full rounded-sm bg-blue-500"
                    style={{ height: `${Math.max(4, (point.count / maxTrend) * 72)}px` }}
                    title={`${point.day}: ${point.count}`}
                  />
                  <span className="text-[10px] text-[#64748B]">{point.count}</span>
                </div>
              ))}
            </div>
          </section>
          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 dark:border-border dark:bg-card">
              <h2 className="text-sm font-semibold">OpenHRM Usage</h2>
              <p className="mt-1 text-xs text-[#64748B]">Application calls logged this month. These are not Google charges.</p>
              <ul className="mt-3 space-y-2 text-sm">
                <UsageRow label="Autocomplete calls" value={data.openhrm?.autocomplete ?? data.currentMonth.byApi.places_autocomplete ?? 0} />
                <UsageRow label="Place Details calls" value={data.openhrm?.placeDetails ?? data.currentMonth.byApi.place_details ?? 0} />
                {(data.openhrm?.geocode ?? data.currentMonth.byApi.geocode ?? 0) > 0 ? (
                  <UsageRow label="Geocoding calls" value={data.openhrm?.geocode ?? data.currentMonth.byApi.geocode ?? 0} />
                ) : null}
                {(data.openhrm?.reverseGeocode ?? data.currentMonth.byApi.reverse_geocode ?? 0) > 0 ? (
                  <UsageRow label="Reverse Geocoding calls" value={data.openhrm?.reverseGeocode ?? data.currentMonth.byApi.reverse_geocode ?? 0} />
                ) : null}
                <UsageRow label="Total application calls" value={data.openhrm?.total ?? data.currentMonth.total} strong />
              </ul>
            </section>
            <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 dark:border-border dark:bg-card">
              <h2 className="text-sm font-semibold">Google Cloud Usage</h2>
              <p className="mt-1 text-xs text-[#64748B]">Estimate only. Not a Google Cloud invoice.</p>
              <ul className="mt-3 space-y-2 text-sm">
                <UsageRow label="Billable Autocomplete" value={data.googleCloud?.billableAutocomplete ?? 0} />
                <UsageRow label="Billable Place Details" value={data.googleCloud?.billablePlaceDetails ?? 0} />
                <UsageRow label="Actual Google usage" value="—" />
                <UsageRow label="Actual Google cost" value="—" />
              </ul>
              <p className="mt-3 text-xs text-[#64748B]">
                {data.googleCloud?.note ||
                  "Actual usage and cost come from Google Cloud Billing. OpenHRM does not invent a dollar amount."}
              </p>
            </section>
          </div>
          <CountList title="By OpenHRM feature" items={rows(data.currentMonth.byFeature, FEATURE_LABELS)} />
          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 dark:border-border dark:bg-card">
            <h2 className="text-sm font-semibold">Recent requests</h2>
            <div className="mt-3 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-[#64748B]">
                  <tr>
                    <th className="py-2 pr-3">When</th>
                    <th className="py-2 pr-3">API</th>
                    <th className="py-2 pr-3">Feature</th>
                    <th className="py-2">HTTP</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.length ? (
                    data.recent.map((row, index) => (
                      <tr key={`${row.createdAt}-${index}`} className="border-t border-[#E5E7EB]">
                        <td className="py-2 pr-3">{new Date(row.createdAt).toLocaleString("en-IN")}</td>
                        <td className="py-2 pr-3">{API_LABELS[row.api] || row.api}</td>
                        <td className="py-2 pr-3">{FEATURE_LABELS[row.feature] || row.feature}</td>
                        <td className="py-2">{row.httpStatus}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="py-3 text-[#64748B]" colSpan={4}>
                        No Google calls logged yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function UsageRow({ label, value, strong }: { label: string; value: number | string; strong?: boolean }) {
  return (
    <li className={`flex justify-between gap-3 ${strong ? "border-t border-[#E5E7EB] pt-2 font-semibold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</span>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 dark:border-border dark:bg-card">
      <p className="text-xs text-[#64748B]">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-[#0F172A] dark:text-foreground">{value}</p>
    </div>
  );
}

function CountList({ title, items }: { title: string; items: { key: string; label: string; count: number }[] }) {
  return (
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 dark:border-border dark:bg-card">
      <h2 className="text-sm font-semibold">{title}</h2>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-sm">
          {items.map((item) => (
            <li key={item.key} className="flex justify-between gap-3">
              <span>{item.label}</span>
              <span className="tabular-nums">{item.count.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[#64748B]">No calls this month</p>
      )}
    </section>
  );
}
