"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import { toast } from "sonner";
import EmpMobileLayout from "../components/layout/EmpMobileLayout";
import { downloadPayslipForSalaryRow } from "../empGenerateSalary/EmpGenerateSalaryPage";
import {
  fetchEmployeePayslips,
  formatPayslipMonthYear,
  parseMonthYearFromPeriod,
  type EmpPayslipRow,
} from "../utils/empPayslipApi";

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

function EmpPayoutContent() {
  const searchParams = useSearchParams();
  const now = new Date();
  const initial = readFilterFromSearchParams(searchParams);
  const [rows, setRows] = useState<EmpPayslipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

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
    return rows.filter((r) => {
      const p = parseMonthYearFromPeriod(r.monthPeriod);
      if (!p) return true;
      return p.month === month && p.year === year;
    });
  }, [rows, month, year]);

  return (
    <div className="px-4 pt-6 pb-8">
      <h1 className="text-[22px] font-bold text-gray-900 mb-1">Payout</h1>
      <p className="text-[12px] text-gray-500 mb-4">
        View payslips after payroll is generated. Raise a query if anything looks wrong.
      </p>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Month</span>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="app-form-control mt-1 w-full h-10 px-3 rounded-xl border border-gray-200 text-[13px]"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Year</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="app-form-control mt-1 w-full h-10 px-3 rounded-xl border border-gray-200 text-[13px]"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Icon icon="solar:refresh-bold-duotone" className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Icon icon="solar:bill-bold-duotone" className="w-10 h-10 text-gray-200 mx-auto mb-2" />
          <p className="text-[13px] text-gray-400">No payslips for this month</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-[1fr_auto] gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            <span>Month / Year</span>
            <span>Action</span>
          </div>
          {filtered.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[1fr_auto] gap-2 items-center px-4 py-3 border-b border-gray-50 last:border-0"
            >
              <p className="text-[14px] font-bold text-gray-900">
                {formatPayslipMonthYear(row.monthPeriod)}
              </p>
              <div className="flex flex-wrap justify-end gap-1">
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EmpPayoutPage() {
  return (
    <EmpMobileLayout>
      <Suspense
        fallback={
          <div className="px-4 pt-6 pb-8 flex justify-center py-16">
            <Icon icon="solar:refresh-bold-duotone" className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        }
      >
        <EmpPayoutContent />
      </Suspense>
    </EmpMobileLayout>
  );
}
