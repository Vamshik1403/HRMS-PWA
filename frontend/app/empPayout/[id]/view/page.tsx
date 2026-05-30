"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import EmpMobileLayout from "../../../components/layout/EmpMobileLayout";
import { toast } from "sonner";
import { downloadPayslipForSalaryRow } from "../../../empGenerateSalary/EmpGenerateSalaryPage";
import { formatPayslipMonthYear, type EmpPayslipRow } from "../../../utils/empPayslipApi";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

export default function EmpPayoutViewPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const [row, setRow] = useState<EmpPayslipRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
    if (!token) {
      router.replace("/login");
      return;
    }
    fetch(`${BACKEND}/generate-salary/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(setRow)
      .finally(() => setLoading(false));
  }, [id, router]);

  return (
    <EmpMobileLayout hideBottomNav>
      <div className="px-4 pt-4 pb-8 min-h-full bg-gray-50">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1 text-[13px] font-semibold text-[#2563eb] mb-3"
        >
          <Icon icon="solar:arrow-left-linear" className="w-5 h-5" />
          Back
        </button>

        {loading ? (
          <div className="py-16 flex justify-center">
            <Icon icon="solar:refresh-bold-duotone" className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        ) : !row ? (
          <p className="text-[13px] text-gray-500">Payslip not found</p>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div className="text-center border-b border-gray-100 pb-4">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Salary Slip</p>
              <h1 className="text-[20px] font-bold text-gray-900 mt-1">
                {formatPayslipMonthYear(row.monthPeriod)}
              </h1>
              <p className="text-[12px] text-gray-500 mt-1">
                {row.company?.companyName}
                {row.branches?.branchName ? ` · ${row.branches.branchName}` : ""}
              </p>
            </div>

            <dl className="space-y-3 text-[13px]">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Status</dt>
                <dd
                  className={`font-bold ${
                    row.status === "Paid" ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {row.status || "Pending"}
                </dd>
              </div>
              {row.paymentDate && (
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Payment date</dt>
                  <dd className="font-semibold text-gray-900">{row.paymentDate}</dd>
                </div>
              )}
              {row.paymentMode && (
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Payment mode</dt>
                  <dd className="font-semibold text-gray-900">{row.paymentMode}</dd>
                </div>
              )}
              {row.paymentType && (
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Payment type</dt>
                  <dd className="font-semibold text-gray-900">{row.paymentType}</dd>
                </div>
              )}
              {row.paymentRemark && (
                <div>
                  <dt className="text-gray-500 mb-1">Remark</dt>
                  <dd className="font-medium text-gray-800">{row.paymentRemark}</dd>
                </div>
              )}
            </dl>

            <p className="text-[12px] text-gray-400 leading-relaxed">
              For earnings, deductions, and net pay breakdown, download the full PDF payslip.
            </p>

            <button
              type="button"
              disabled={downloading}
              onClick={async () => {
                setDownloading(true);
                try {
                  await downloadPayslipForSalaryRow(row as Parameters<typeof downloadPayslipForSalaryRow>[0]);
                  toast.success("Payslip downloaded");
                } catch (err) {
                  console.error("Payslip download failed:", err);
                  toast.error("Download failed. Check attendance/shift setup and try again.");
                } finally {
                  setDownloading(false);
                }
              }}
              className="w-full h-12 rounded-xl bg-[#2563eb] text-white text-[14px] font-bold active:scale-[0.98] disabled:opacity-60"
            >
              {downloading ? "Generating…" : "Download PDF"}
            </button>
          </div>
        )}
      </div>
    </EmpMobileLayout>
  );
}
