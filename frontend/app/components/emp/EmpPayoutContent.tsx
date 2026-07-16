"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import { toast } from "sonner";
import { downloadPayslipForSalaryRow } from "../../empGenerateSalary/EmpGenerateSalaryPage";
import {
  fetchEmployeePayslips,
  formatPayslipMonthYear,
  parseMonthYearFromPeriod,
  type EmpPayslipRow,
} from "../../utils/empPayslipApi";
import { splitPreviewRecords } from "../../utils/empListLimit";
import { EmpRecordHistorySheet } from "./EmpRecordHistorySheet";
import { EmpListViewMoreButton } from "./EmpListViewMoreButton";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { listCardClass } from "../app/list-ui-styles";
import { filterSelectClass } from "../../dashboard/components/dashboard-ui";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function readFilterFromSearchParams(searchParams: URLSearchParams) {
  const now = new Date();
  const monthParam = searchParams.get("month");
  const yearParam = searchParams.get("year");
  const month = monthParam && Number(monthParam) >= 1 && Number(monthParam) <= 12
    ? Number(monthParam)
    : now.getMonth() + 1;
  const year = yearParam && Number(yearParam) >= 2000
    ? Number(yearParam)
    : now.getFullYear();
  return { month, year };
}

export function EmpPayoutContent({ embedded = false }: { embedded?: boolean }) {
  const searchParams = useSearchParams();
  const now = new Date();
  const initial = readFilterFromSearchParams(searchParams);
  const [rows, setRows] = useState<EmpPayslipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    const next = readFilterFromSearchParams(searchParams);
    setMonth(next.month);
    setYear(next.year);
  }, [searchParams]);

  useEffect(() => {
    fetchEmployeePayslips()
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  const years = useMemo(() => {
    const set = new Set(rows.map((r) => parseMonthYearFromPeriod(r.monthPeriod)?.year).filter(Boolean) as number[]);
    set.add(year);
    set.add(now.getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [rows, year, now]);

  const filtered = useMemo(() => {
    return rows
      .filter((r) => {
        const p = parseMonthYearFromPeriod(r.monthPeriod);
        if (!p) return true;
        return p.month === month && p.year === year;
      })
      .sort((a, b) => {
        const pa = parseMonthYearFromPeriod(a.monthPeriod);
        const pb = parseMonthYearFromPeriod(b.monthPeriod);
        if (!pa || !pb) return 0;
        return pb.year - pa.year || pb.month - pa.month;
      });
  }, [rows, month, year]);

  const { preview, history, hasHistory } = splitPreviewRecords(filtered);

  const renderPayslipRow = (row: EmpPayslipRow) => (
    <div
      key={row.id}
      className={`grid grid-cols-[1fr_auto] gap-2 items-center px-4 py-3 border-b last:border-0 ${
        embedded ? "border-border" : "border-gray-50"
      }`}
    >
      <p className={embedded ? "text-sm font-semibold text-foreground" : "text-[14px] font-bold text-gray-900"}>
        {formatPayslipMonthYear(row.monthPeriod)}
      </p>
      <div className="flex flex-wrap justify-end gap-1">
        {embedded ? (
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/empPayout/${row.id}/view`}>View</Link>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={downloadingId === row.id}
              onClick={async () => {
                setDownloadingId(row.id);
                try {
                  await downloadPayslipForSalaryRow(row as Parameters<typeof downloadPayslipForSalaryRow>[0]);
                  toast.success("Payslip downloaded");
                } catch (err) {
                  console.error("Payslip download failed:", err);
                  toast.error("Download failed. Check attendance/shift setup and try again.");
                } finally {
                  setDownloadingId(null);
                }
              }}
            >
              {downloadingId === row.id ? "…" : "Download"}
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/empPayout/${row.id}/query`}>Raise query</Link>
            </Button>
          </>
        ) : (
          <>
            <Link
              href={`/empPayout/${row.id}/view`}
              className="text-[10px] font-bold text-[#2563eb] bg-blue-50 border border-blue-100 px-2 py-1 rounded-lg"
            >
              View
            </Link>
            <button
              type="button"
              disabled={downloadingId === row.id}
              onClick={async () => {
                setDownloadingId(row.id);
                try {
                  await downloadPayslipForSalaryRow(row as Parameters<typeof downloadPayslipForSalaryRow>[0]);
                  toast.success("Payslip downloaded");
                } catch (err) {
                  console.error("Payslip download failed:", err);
                  toast.error("Download failed. Check attendance/shift setup and try again.");
                } finally {
                  setDownloadingId(null);
                }
              }}
              className="text-[10px] font-bold text-gray-700 bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg disabled:opacity-50"
            >
              {downloadingId === row.id ? "…" : "Download"}
            </button>
            <Link
              href={`/empPayout/${row.id}/query`}
              className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-1 rounded-lg"
            >
              Raise Query
            </Link>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className={embedded ? "" : "px-4 pt-6 pb-8"}>
      {!embedded && (
        <>
          <h1 className="text-[22px] font-bold text-gray-900 mb-1">Payout</h1>
          <p className="text-[12px] text-gray-500 mb-4">
            View payslips after payroll is generated. Raise a query if anything looks wrong.
          </p>
        </>
      )}

      <Card className={`${listCardClass} mb-6`}>
        <CardHeader>
          <CardTitle className="text-base">Filter by period</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Month</span>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className={`${filterSelectClass} w-full`}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Year</span>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className={`${filterSelectClass} w-full`}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
        </CardContent>
      </Card>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Icon icon="solar:refresh-bold-duotone" className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className={listCardClass}>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No payslips for this month
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className={`${listCardClass} overflow-hidden`}>
            <div className="grid grid-cols-[1fr_auto] gap-2 px-4 py-3 bg-muted/40 border-b border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Month / year</span>
              <span>Actions</span>
            </div>
            {preview.map(renderPayslipRow)}
          </Card>
          {hasHistory && (
            <EmpListViewMoreButton count={history.length} onClick={() => setHistoryOpen(true)} />
          )}
          <EmpRecordHistorySheet
            open={historyOpen}
            onClose={() => setHistoryOpen(false)}
            title="Payslip history"
            subtitle={`${history.length} older payslip(s)`}
          >
            <div className={`${listCardClass} overflow-hidden`}>
              {history.map(renderPayslipRow)}
            </div>
          </EmpRecordHistorySheet>
        </>
      )}
    </div>
  );
}
