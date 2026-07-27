"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { CalendarDays } from "lucide-react";
import EmpMobileLayout from "../../components/layout/EmpMobileLayout";
import { EmpDesktopWorkspaceGate } from "../../components/emp/EmpDesktopWorkspaceGate";
import { EmpDesktopPage } from "../../components/emp/desktop/EmpDesktopPage";
import { markEmpRecordSeen } from "../../utils/empHomeSeen";
import { useEmpManagerScope } from "../../hooks/useEmpManagerScope";
import { isTeamMemberId, nameForEmployeeId } from "../../utils/empManagerDisplay";
import {
  formatDateShort,
  getAppliedDateRange,
  getApprovedDateRange,
  getDisplayLeaveStatus,
  getDisplayLeaveType,
  parseDayStatuses,
} from "../../utils/leaveDisplay";
import { EmpLeaveApprovalSheet } from "../../components/emp/EmpLeaveApprovalSheet";
import { Button } from "../../components/ui/button";
import { cn } from "@/app/utils/cn";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
      : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function EmpLeaveDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id || "");
  const { scope, isManagerView } = useEmpManagerScope();
  const [app, setApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [approvalOpen, setApprovalOpen] = useState(false);

  const reload = () =>
    fetch(`${BACKEND}/leave-application/${id}`, { cache: "no-store", headers: authHeaders() })
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
      });

  useEffect(() => {
    reload().finally(() => setLoading(false));
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
  const teamLeave = isTeamMemberId(scope, app.manageEmployeeID);
  const canManagerApprove =
    isManagerView && teamLeave && displayStatus === "Approval Pending";
  const teamName =
    nameForEmployeeId(scope, app.manageEmployeeID) ||
    [app.manageEmployee?.employeeFirstName, app.manageEmployee?.employeeLastName]
      .filter(Boolean)
      .join(" ") ||
    "Team member";

  const fields = [
    { label: "Status", value: displayStatus },
    { label: "Request date", value: formatDateShort(app.createdAt) },
    { label: "Applied period", value: getAppliedDateRange(app) },
    { label: "Approved period", value: getApprovedDateRange(app) },
    { label: "Leave type", value: getDisplayLeaveType(app) },
  ];

  const mobile = (
    <div className="px-4 pt-4 pb-8">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1 text-[13px] font-semibold text-[#2563eb] mb-3"
      >
        <Icon icon="solar:arrow-left-linear" className="w-5 h-5" />
        Back
      </button>
      <h1 className="text-[20px] font-bold text-gray-900 mb-1">Leave details</h1>
      {teamLeave && (
        <p className="text-[12px] font-semibold text-[#2563eb] mb-3">Team member · {teamName}</p>
      )}
      <div className="rounded-2xl border border-[#cbd5e1] bg-card shadow-sm p-5 space-y-3 text-[13px]">
        {fields.map((f) => (
          <MobileRow key={f.label} label={f.label} value={f.value} />
        ))}
        <MobileRow label="Reason" value={app.purpose || "—"} />
      </div>
      {dayRows.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-bold text-muted-foreground uppercase mb-2">Day-wise approval</p>
          <div className="space-y-2">
            {dayRows.map((d) => (
              <div
                key={d.date}
                className="rounded-xl border border-[#cbd5e1] bg-card px-3 py-2.5 flex justify-between text-[12px]"
              >
                <span>{formatDateShort(d.date)}</span>
                <span className={`font-semibold ${d.status ? "text-foreground" : "text-muted-foreground"}`}>
                  {d.status ? d.status : "Not approved"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {canManagerApprove && (
        <Button
          type="button"
          className="mt-5 w-full bg-emerald-600 hover:bg-emerald-700"
          onClick={() => setApprovalOpen(true)}
        >
          Review & approve
        </Button>
      )}
    </div>
  );

  const desktop = (
    <EmpDesktopPage
      title="Leave details"
      description={teamLeave ? `Team member · ${teamName}` : "Request details"}
      icon={CalendarDays}
      actions={
        <div className="flex items-center gap-2">
          {canManagerApprove ? (
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setApprovalOpen(true)}
            >
              Review & approve
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => router.back()}>
            Back
          </Button>
        </div>
      }
    >
      <div className="w-full space-y-5">
        <section className="rounded-2xl border border-[#cbd5e1] bg-card shadow-sm overflow-hidden">
          <div className="border-b border-[#cbd5e1] bg-muted/30 px-6 py-3">
            <h2 className="text-sm font-semibold text-foreground">Request summary</h2>
          </div>
          <div className="grid grid-cols-2 gap-0 lg:grid-cols-3 xl:grid-cols-5">
            {fields.map((f, i) => (
              <div
                key={f.label}
                className={cn(
                  "px-6 py-4 border-[#cbd5e1]",
                  i < fields.length - 1 && "border-r",
                  i >= 2 && "border-t lg:border-t-0",
                  i >= 3 && "xl:border-t-0",
                  i === 2 && "lg:border-r-0 xl:border-r",
                  i === 3 && "border-t lg:border-t xl:border-t-0",
                  i === 4 && "border-t col-span-2 lg:col-span-1 xl:col-span-1",
                )}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {f.label}
                </p>
                <p className="mt-1.5 text-[15px] font-semibold text-foreground break-words">
                  {f.value || "—"}
                </p>
              </div>
            ))}
          </div>
          <div className="border-t border-[#cbd5e1] px-6 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Reason
            </p>
            <p className="mt-1.5 text-[15px] font-medium text-foreground whitespace-pre-wrap">
              {app.purpose || "—"}
            </p>
          </div>
        </section>

        {dayRows.length > 0 && (
          <section className="rounded-2xl border border-[#cbd5e1] bg-card shadow-sm overflow-hidden">
            <div className="border-b border-[#cbd5e1] bg-muted/30 px-6 py-3">
              <h2 className="text-sm font-semibold text-foreground">Day-wise approval</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left">
                <thead>
                  <tr className="border-b border-[#cbd5e1] bg-muted/20">
                    <th className="px-6 py-3 text-[12px] font-semibold text-muted-foreground">Date</th>
                    <th className="px-6 py-3 text-[12px] font-semibold text-muted-foreground">Status</th>
                    <th className="px-6 py-3 text-[12px] font-semibold text-muted-foreground">Leave type</th>
                  </tr>
                </thead>
                <tbody>
                  {dayRows.map((d) => (
                    <tr key={d.date} className="border-b border-[#cbd5e1]/80 last:border-0">
                      <td className="px-6 py-3.5 text-[14px] font-medium text-foreground">
                        {formatDateShort(d.date)}
                      </td>
                      <td className="px-6 py-3.5 text-[14px] font-semibold text-foreground">
                        {d.status || "Not approved"}
                      </td>
                      <td className="px-6 py-3.5 text-[14px] text-muted-foreground">
                        {(d as { leaveType?: string }).leaveType ||
                          (d as { dayType?: string }).dayType ||
                          "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </EmpDesktopPage>
  );

  return (
    <EmpMobileLayout>
      <EmpDesktopWorkspaceGate workspace={desktop} mobile={mobile} />
      <EmpLeaveApprovalSheet
        open={approvalOpen}
        onClose={() => setApprovalOpen(false)}
        application={app}
        onDone={() => void reload()}
      />
    </EmpMobileLayout>
  );
}

function MobileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-semibold text-foreground text-right">{value}</span>
    </div>
  );
}
