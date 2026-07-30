"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { CalendarDays } from "lucide-react";
import { EmpDesktopPage } from "./desktop/EmpDesktopPage";
import { useEmpPortalDesktop } from "@/app/components/layout/EmpPortalShell";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

export type EmpHolidayRow = {
  id: number;
  name: string;
  financialYear: string | null;
  startDate: string;
  endDate: string;
  isUpcoming: boolean;
};

function formatDisplayDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function dateRangeLabel(start: string, end: string): string {
  if (!start) return "—";
  if (start === end) return formatDisplayDate(start);
  return `${formatDisplayDate(start)} – ${formatDisplayDate(end)}`;
}

export function EmpHolidayListMobile({ embedded = false }: { embedded?: boolean } = {}) {
  const isDesktop = useEmpPortalDesktop();
  const [holidays, setHolidays] = useState<EmpHolidayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("token") || localStorage.getItem("accessToken")
          : null;
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${BACKEND}/emp-notifications/holidays`, {
        headers,
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Could not load holidays");
      const data = (await res.json()) as EmpHolidayRow[];
      setHolidays(Array.isArray(data) ? data : []);
    } catch {
      setError("Unable to load holiday list. Pull to refresh or try again later.");
      setHolidays([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { upcoming, past } = useMemo(() => {
    const up: EmpHolidayRow[] = [];
    const pa: EmpHolidayRow[] = [];
    for (const h of holidays) {
      if (h.isUpcoming) up.push(h);
      else pa.push(h);
    }
    return { upcoming: up, past: pa.reverse() };
  }, [holidays]);

  const allRows = useMemo(
    () => [
      ...upcoming.map((h) => ({ ...h, section: "Upcoming" as const })),
      ...past.map((h) => ({ ...h, section: "Past" as const })),
    ],
    [upcoming, past],
  );

  const renderSection = (title: string, items: EmpHolidayRow[], accent: string) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 px-1">
          {title}
        </p>
        <div className="space-y-2">
          {items.map((h) => (
            <div
              key={h.id}
              className="bg-white rounded-[18px] border border-gray-100 shadow-[0_2px_12px_rgba(15,23,42,0.06)] p-4"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent}`}
                >
                  <Icon icon="solar:calendar-mark-bold-duotone" className="w-5 h-5 text-rose-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold text-gray-900 leading-snug">{h.name}</p>
                  <p className="text-[13px] text-gray-700 mt-1 font-medium">
                    {dateRangeLabel(h.startDate, h.endDate)}
                  </p>
                  {h.financialYear ? (
                    <p className="text-[11px] text-gray-500 mt-1">FY: {h.financialYear}</p>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const body = (
    <>
      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading holidays…</p>
      ) : error ? (
        <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-800">
          {error}
          <button
            type="button"
            onClick={() => void load()}
            className="block mt-2 font-semibold text-[#4f46e5]"
          >
            Retry
          </button>
        </div>
      ) : holidays.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No public holidays are configured for your branch yet.
        </div>
      ) : isDesktop && !embedded ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Holiday</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">
                    Financial year
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {allRows.map((h) => (
                  <tr key={h.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">{h.name}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {dateRangeLabel(h.startDate, h.endDate)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {h.financialYear || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          h.section === "Upcoming"
                            ? "inline-flex rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700"
                            : "inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground"
                        }
                      >
                        {h.section}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          {renderSection("Upcoming & today", upcoming, "bg-rose-50")}
          {renderSection("Past", past, "bg-gray-50")}
        </>
      )}
    </>
  );

  if (embedded) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">My holidays</h3>
          <p className="text-sm text-muted-foreground">Company holidays on your calendar</p>
        </div>
        {body}
      </div>
    );
  }

  if (isDesktop) {
    return (
      <EmpDesktopPage
        title="Holidays"
        description="Public holidays for your company from the leave policy calendar"
        icon={CalendarDays}
      >
        {body}
      </EmpDesktopPage>
    );
  }

  return (
    <div className="px-4 pt-3 pb-8">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Holiday list</h1>
      <p className="text-sm text-gray-500 mb-4">
        Public holidays for your company from the leave policy calendar.
      </p>
      {body}
    </div>
  );
}
