"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import EmpMobileLayout from "../../components/layout/EmpMobileLayout";
import { markEmpRecordSeen } from "../../utils/empHomeSeen";
import {
  getAppliedDateRange,
  getApprovedDateRange,
  getDisplayLeaveStatus,
  getDisplayLeaveType,
  parseDayStatuses,
} from "../../utils/leaveDisplay";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

export default function EmpLeaveDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id || "");
  const [app, setApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND}/leave-application/${id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          markEmpRecordSeen("leave", data.id, data.status);
          setApp({
            ...data,
            fromDate: data.fromDate ? new Date(data.fromDate).toISOString().slice(0, 10) : "",
            toDate: data.toDate ? new Date(data.toDate).toISOString().slice(0, 10) : "",
            createdAt: data.createdAt || "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <EmpMobileLayout>
        <div className="py-16 flex justify-center">
          <Icon icon="solar:refresh-bold-duotone" className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      </EmpMobileLayout>
    );
  }

  if (!app) {
    return (
      <EmpMobileLayout>
        <div className="px-4 pt-6 text-center text-gray-500">Leave request not found</div>
      </EmpMobileLayout>
    );
  }

  const displayStatus = getDisplayLeaveStatus(app.status, app.dayStatuses);
  const dayRows = parseDayStatuses(app.dayStatuses);

  return (
    <EmpMobileLayout>
      <div className="px-4 pt-4 pb-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1 text-[13px] font-semibold text-[#2563eb] mb-3"
        >
          <Icon icon="solar:arrow-left-linear" className="w-5 h-5" />
          Back
        </button>

        <h1 className="text-[20px] font-bold text-gray-900 mb-4">Leave details</h1>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3 text-[13px]">
          <Row label="Status" value={displayStatus} />
          <Row label="Request date" value={new Date(app.createdAt).toLocaleDateString("en-IN")} />
          <Row label="Applied period" value={getAppliedDateRange(app)} />
          <Row label="Approved period" value={getApprovedDateRange(app)} />
          <Row label="Leave type" value={getDisplayLeaveType(app)} />
          <Row label="Reason" value={app.purpose || "—"} />
        </div>

        {dayRows.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] font-bold text-gray-400 uppercase mb-2">Day-wise approval</p>
            <div className="space-y-1">
              {dayRows.map((d) => (
                <div
                  key={d.date}
                  className="bg-white rounded-xl border border-gray-100 px-3 py-2 flex justify-between text-[12px]"
                >
                  <span>{d.date}</span>
                  <span className="font-semibold text-gray-700">{d.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </EmpMobileLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-gray-50 pb-2 last:border-0 last:pb-0">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="font-semibold text-gray-900 text-right">{value}</span>
    </div>
  );
}
