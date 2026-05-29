"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { toast } from "sonner";
import EmpMobileLayout from "../../../components/layout/EmpMobileLayout";
import { useCurrentUser } from "../../../hooks/useCurrentUser";
import { taskFetch } from "../../../utils/taskApi";
import { formatPayslipMonthYear, type EmpPayslipRow } from "../../../utils/empPayslipApi";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

export default function EmpPayoutQueryPage() {
  const params = useParams();
  const router = useRouter();
  const user = useCurrentUser();
  const id = Number(params.id);
  const [row, setRow] = useState<EmpPayslipRow | null>(null);
  const [remark, setRemark] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

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
      .catch(() => setRow(null));
  }, [id, router]);

  const submit = async () => {
    if (!user || !row || !remark.trim()) {
      toast.error("Please enter a remark");
      return;
    }
    setSubmitting(true);
    try {
      const depts = await fetch(`${BACKEND}/departments`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || localStorage.getItem("accessToken") || ""}`,
        },
      }).then((r) => (r.ok ? r.json() : []));

      const adminDept = Array.isArray(depts)
        ? depts.find((d: { departmentName?: string }) =>
            (d.departmentName || "").toLowerCase().includes("admin"),
          )
        : null;

      const periodLabel = formatPayslipMonthYear(row.monthPeriod);
      const taskName = `Query related to payslip for ${periodLabel}`;

      await taskFetch("/task-projects", user, {
        method: "POST",
        body: JSON.stringify({
          taskName,
          taskType: "Job / Work Task",
          description: `Payslip query (${periodLabel})\nDate: ${today}\n\n${remark.trim()}`,
          priority: "Medium",
          departmentID: adminDept?.id ?? undefined,
        }),
      });

      toast.success("Query submitted to Admin department");
      router.replace("/empPayout");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not submit query");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <EmpMobileLayout hideBottomNav>
      <div className="px-4 pt-4 pb-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1 text-[13px] font-semibold text-[#2563eb] mb-3"
        >
          <Icon icon="solar:arrow-left-linear" className="w-5 h-5" />
          Back
        </button>

        <h1 className="text-[20px] font-bold text-gray-900 mb-1">Raise Query</h1>
        {row && (
          <p className="text-[12px] text-gray-500 mb-5">
            Payslip: {formatPayslipMonthYear(row.monthPeriod)}
          </p>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <label className="block">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Date</span>
            <input
              type="date"
              value={today}
              readOnly
              className="mt-1 w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-[13px] text-gray-600"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Remark</span>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="Describe your payslip concern…"
              className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-[14px] resize-none focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30"
            />
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !remark.trim()}
            className="w-full h-12 rounded-xl bg-[#2563eb] text-white text-[14px] font-bold disabled:opacity-50 active:scale-[0.98]"
          >
            {submitting ? "Submitting…" : "Submit query"}
          </button>
        </div>
      </div>
    </EmpMobileLayout>
  );
}
