"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { listCardClass } from "../app/list-ui-styles";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

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
  const initial = readFilterFromSearchParams(searchParams);
  const [rows, setRows] = useState<EmpPayslipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const monthInputRef = useRef<HTMLInputElement>(null);

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

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const openMonthPicker = () => {
    const el = monthInputRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        /* fall through */
      }
    }
    el.click();
  };

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

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <input
              ref={monthInputRef}
              type="month"
              value={`${year}-${pad2(month)}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split("-").map(Number);
                if (y && m) {
                  setYear(y);
                  setMonth(m);
                }
              }}
              className="sr-only"
              aria-hidden
              tabIndex={-1}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              onClick={openMonthPicker}
              aria-label="Select month"
            >
              <Calendar className="size-4" />
            </Button>
            <h3 className="text-sm font-semibold text-foreground">{monthLabel}</h3>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => {
                const d = new Date(year, month - 2, 1);
                setYear(d.getFullYear());
                setMonth(d.getMonth() + 1);
              }}
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => {
                const d = new Date(year, month, 1);
                setYear(d.getFullYear());
                setMonth(d.getMonth() + 1);
              }}
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

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
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border bg-muted/40 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground grid grid-cols-[1fr_auto] gap-2">
              <span>Month / year</span>
              <span>Actions</span>
            </div>
            {preview.map(renderPayslipRow)}
          </div>
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
