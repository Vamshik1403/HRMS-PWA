"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { Plus } from "lucide-react";
import EmpMobileLayout from "../components/layout/EmpMobileLayout";
import { getPageCache, setPageCache } from "../utils/pageCache";
import { useEmpManagerScope } from "../hooks/useEmpManagerScope";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { splitPreviewRecords } from "../utils/empListLimit";
import { EmpRecordHistorySheet } from "../components/emp/EmpRecordHistorySheet";
import { EmpListViewMoreButton } from "../components/emp/EmpListViewMoreButton";
import { ManagerMemoComposeSheet } from "../components/emp/ManagerMemoComposeSheet";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

interface Memo {
  id: number;
  subject: string | null;
  description: string | null;
  memoType: string | null;
  issuedDate: string | null;
  issuedBy: string | null;
  createdAt: string | null;
}

function fmt(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function memoIcon(type: string | null) {
  const icons: Record<string, string> = {
    Warning: "solar:danger-triangle-bold-duotone",
    Appreciation: "solar:medal-ribbon-bold-duotone",
    Policy: "solar:document-text-bold-duotone",
    General: "solar:bell-bold-duotone",
  };
  return icons[type || "General"] || "solar:bell-bold-duotone";
}

function memoColor(type: string | null) {
  const colors: Record<string, string> = {
    Warning: "text-red-500 bg-red-50",
    Appreciation: "text-amber-500 bg-amber-50",
    Policy: "text-blue-500 bg-blue-50",
    General: "text-violet-500 bg-violet-50",
  };
  return colors[type || "General"] || "text-violet-500 bg-violet-50";
}

export default function EmpNoticeboardPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const { scope, isManagerView } = useEmpManagerScope();
  const [memos, setMemos] = useState<Memo[]>(() => getPageCache<Memo[]>("empMemos") ?? []);
  const [loading, setLoading] = useState(() => getPageCache<Memo[]>("empMemos") === null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const employeeIDRef = useRef<number | null>(null);

  const loadMemos = useCallback(async (empId: number) => {
    try {
      const token = localStorage.getItem("token");
      const r = await fetch(`${BACKEND}/employee-memo`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await r.json();
      if (!Array.isArray(data)) {
        setMemos([]);
        return;
      }
      const filtered = data.filter((m: { employeeID?: number }) => m.employeeID === empId);
      filtered.sort(
        (a: Memo, b: Memo) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      );
      setPageCache("empMemos", filtered);
      setMemos(filtered);
    } catch {
      setMemos([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("_notice_last_viewed", Date.now().toString());

    const userRaw = localStorage.getItem("user");
    if (!userRaw) {
      setLoading(false);
      return;
    }

    let employeeID: number | null = null;
    try {
      const parsed = JSON.parse(userRaw);
      employeeID = parsed?.employee?.id ?? null;
    } catch {
      setLoading(false);
      return;
    }

    if (!employeeID) {
      setLoading(false);
      return;
    }
    employeeIDRef.current = employeeID;

    loadMemos(employeeID).finally(() => setLoading(false));

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") loadMemos(employeeID!);
    }, 20000);
    const onVisible = () => {
      if (document.visibilityState === "visible") loadMemos(employeeID!);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadMemos]);

  const { preview, history, hasHistory } = splitPreviewRecords(memos);
  const directReportees =
    scope?.reportees.filter((r) => r.id !== scope.employeeId) ?? [];
  const managerName = user?.username || "Manager";

  const renderMemo = (memo: Memo) => {
    const isExpanded = expandedId === memo.id;
    const colorClass = memoColor(memo.memoType);
    const icon = memoIcon(memo.memoType);
    return (
      <div
        key={memo.id}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
      >
        <button
          className="w-full text-left p-4 flex items-start gap-3 active:bg-gray-50"
          onClick={() => setExpandedId(isExpanded ? null : memo.id)}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}>
            <Icon icon={icon} className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[14px] font-bold text-gray-900 leading-snug line-clamp-2">
                {memo.subject || "Notice"}
              </p>
              <Icon
                icon={isExpanded ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"}
                className="w-4 h-4 text-gray-400 shrink-0 mt-0.5"
              />
            </div>
            <div className="flex items-center gap-2 mt-1">
              {memo.memoType && (
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${colorClass}`}>
                  {memo.memoType}
                </span>
              )}
              <span className="text-[11px] text-gray-400">{fmt(memo.createdAt)}</span>
            </div>
          </div>
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 space-y-3 border-t border-gray-50">
            {memo.description && (
              <div className="pt-3">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Details</p>
                <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-line">{memo.description}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-3 pt-1">
              {memo.issuedDate && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Issued Date</p>
                  <p className="text-[13px] font-semibold text-gray-700">{fmt(memo.issuedDate)}</p>
                </div>
              )}
              {memo.issuedBy && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Issued By</p>
                  <p className="text-[13px] font-semibold text-gray-700">{memo.issuedBy}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <EmpMobileLayout>
      <div className="px-4 pt-5 pb-6 space-y-4">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center active:scale-[0.92]"
          >
            <Icon icon="solar:arrow-left-linear" className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-[22px] font-bold text-gray-900">Notice Board</h1>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Icon icon="solar:spinner-bold-duotone" className="w-8 h-8 text-gray-300 animate-spin" />
            <p className="text-[13px] text-gray-400">Loading notices…</p>
          </div>
        ) : memos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center">
              <Icon icon="solar:bell-bold-duotone" className="w-8 h-8 text-amber-400" />
            </div>
            <p className="text-[15px] font-semibold text-gray-700">No notices yet</p>
            <p className="text-[13px] text-gray-400 text-center">
              {isManagerView ? "Send a notice or warning to your team" : "Notices from HR will appear here"}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">{preview.map(renderMemo)}</div>
            {hasHistory && (
              <EmpListViewMoreButton count={history.length} onClick={() => setHistoryOpen(true)} />
            )}
          </>
        )}
      </div>

      <EmpRecordHistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Notice history"
        subtitle={`${history.length} older notice(s)`}
      >
        <div className="space-y-3">{history.map(renderMemo)}</div>
      </EmpRecordHistorySheet>

      {isManagerView && directReportees.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="mobile-fab fixed right-4 z-40 w-14 h-14 rounded-full bg-[#2563eb] text-white shadow-lg flex items-center justify-center active:scale-90"
            style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}
            aria-label="Send notice"
          >
            <Plus className="w-6 h-6" strokeWidth={2.5} />
          </button>
          <ManagerMemoComposeSheet
            open={composeOpen}
            onClose={() => setComposeOpen(false)}
            reportees={directReportees}
            managerName={managerName || undefined}
            onSent={() => {
              if (employeeIDRef.current) void loadMemos(employeeIDRef.current);
            }}
          />
        </>
      )}
    </EmpMobileLayout>
  );
}
