"use client";

import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { Plus, Search, X } from "lucide-react";
import { MobileTaskListCard, MobileTaskListItem, MobileTaskListSkeleton } from "./MobileTaskListCard";
import type { EmpManagerScope } from "../../../utils/empManagerDisplay";
import { splitPreviewRecords } from "../../../utils/empListLimit";
import { EmpRecordHistorySheet } from "../../emp/EmpRecordHistorySheet";
import { EmpListViewMoreButton } from "../../emp/EmpListViewMoreButton";
import {
  isAssignmentRequestTask,
  matchesEmpTaskTab,
} from "../../../utils/taskAssignmentRequest";

const STATUS_TABS = ["Requests", "Open", "WIP", "Closed", "Reopen"] as const;
export type StatusTab = (typeof STATUS_TABS)[number];

export function MobileTaskListView({
  tasks,
  loading,
  searchQuery,
  onSearchChange,
  onTaskClick,
  onCheckInOut,
  onViewInfo,
  onCreateClick,
  showCreateFab = true,
  managerScope,
  isManagerView = false,
  hidePageTitle = false,
  employeeId,
  employeeEmail,
  statusTab: statusTabProp,
  onStatusTabChange,
  sendingAction,
  rescheduleTaskId,
  onAcceptRequest,
  onRescheduleRequest,
}: {
  tasks: MobileTaskListItem[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onTaskClick: (task: MobileTaskListItem) => void;
  onCheckInOut?: (task: MobileTaskListItem) => void;
  onViewInfo?: (task: MobileTaskListItem) => void;
  onCreateClick?: () => void;
  showCreateFab?: boolean;
  managerScope?: EmpManagerScope | null;
  isManagerView?: boolean;
  /** When true, title is shown in the portal navbar instead. */
  hidePageTitle?: boolean;
  employeeId?: number | null;
  employeeEmail?: string | null;
  statusTab?: StatusTab;
  onStatusTabChange?: (tab: StatusTab) => void;
  sendingAction?: boolean;
  rescheduleTaskId?: number | null;
  onAcceptRequest?: (task: MobileTaskListItem) => void;
  onRescheduleRequest?: (task: MobileTaskListItem, reason: string) => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [internalTab, setInternalTab] = useState<StatusTab>("Requests");
  const statusTab = statusTabProp ?? internalTab;
  const setStatusTab = onStatusTabChange ?? setInternalTab;
  const [historyOpen, setHistoryOpen] = useState(false);

  const requestCount = useMemo(
    () => tasks.filter((t) => isAssignmentRequestTask(t, employeeId, employeeEmail)).length,
    [tasks, employeeId, employeeEmail],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = tasks.filter((t) => matchesEmpTaskTab(t, statusTab, employeeId, employeeEmail));
    if (!q) return list;
    return list.filter(
      (t) =>
        t.taskName.toLowerCase().includes(q) ||
        String(t.id).includes(q) ||
        t.taskCode.toLowerCase().includes(q) ||
        (t.customer?.customerName || "").toLowerCase().includes(q) ||
        (t.site?.branchName || "").toLowerCase().includes(q),
    );
  }, [tasks, searchQuery, statusTab, employeeId, employeeEmail]);

  const { preview, history, hasHistory } = splitPreviewRecords(filtered);

  return (
    <div className={hidePageTitle ? "flex flex-col min-h-full" : "flex flex-col min-h-full bg-[#f8f9fb]"}>
      <header
        className={
          hidePageTitle
            ? "z-10 pb-2"
            : "sticky top-0 z-10 bg-[#f8f9fb]/95 backdrop-blur-md px-4 pt-2 pb-2"
        }
      >
        {!hidePageTitle ? (
          <div className="mb-3">
            <h1 className="text-[22px] font-bold text-gray-900 tracking-tight leading-none">Tasks</h1>
            <p className="text-[12px] text-gray-500 mt-1">
              {isManagerView ? "Team member tasks" : "Assigned tasks"}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusTab(tab)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
                  statusTab === tab
                    ? "bg-[#4f46e5] text-white"
                    : "bg-white text-gray-600 border border-gray-100"
                }`}
              >
                {tab === "Requests" && requestCount ? `${tab} (${requestCount})` : tab}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className={`ml-0 w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 ${
              searchOpen
                ? "bg-[#4f46e5] text-white"
                : "bg-white text-gray-600 shadow-sm border border-gray-100"
            }`}
            aria-label="Search"
          >
            {searchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
          </button>
        </div>

        <div
          className={`overflow-hidden transition-all ${
            searchOpen ? "max-h-14 opacity-100 mt-2" : "max-h-0 opacity-0"
          }`}
        >
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search tasks…"
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-white border border-gray-100 text-[14px]"
            />
          </div>
        </div>
      </header>

      <div className={hidePageTitle ? "flex-1 pt-1 pb-8" : "flex-1 px-3 pt-2 pb-28"}>
        {loading ? (
          <MobileTaskListSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center px-6">
            <Icon icon="solar:clipboard-list-linear" className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-[15px] font-semibold text-gray-800">
              {statusTab === "Requests" ? "No task requests" : `No ${statusTab.toLowerCase()} tasks`}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {preview.map((t) => (
                <MobileTaskListCard
                  key={t.id}
                  task={t}
                  managerScope={managerScope}
                  employeeId={employeeId}
                  employeeEmail={employeeEmail}
                  onOpenChat={() => onTaskClick(t)}
                  onCheckInOut={
                    onCheckInOut && !isAssignmentRequestTask(t, employeeId, employeeEmail)
                      ? () => onCheckInOut(t)
                      : undefined
                  }
                  onViewInfo={onViewInfo ? () => onViewInfo(t) : undefined}
                  requestActions={
                    onAcceptRequest && onRescheduleRequest && isAssignmentRequestTask(t, employeeId, employeeEmail)
                      ? {
                          sending: sendingAction,
                          startRescheduleOpen: rescheduleTaskId === t.id,
                          onAccept: () => onAcceptRequest(t),
                          onReschedule: (reason) => onRescheduleRequest(t, reason),
                        }
                      : undefined
                  }
                />
              ))}
            </div>
            {hasHistory && (
              <EmpListViewMoreButton count={history.length} onClick={() => setHistoryOpen(true)} />
            )}
          </>
        )}
      </div>

      <EmpRecordHistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={`${statusTab} task history`}
        subtitle={`${history.length} older task(s)`}
      >
        <div className="space-y-2">
          {history.map((t) => (
            <MobileTaskListCard
              key={t.id}
              task={t}
              managerScope={managerScope}
              employeeId={employeeId}
              employeeEmail={employeeEmail}
              onOpenChat={() => onTaskClick(t)}
              onCheckInOut={
                onCheckInOut && !isAssignmentRequestTask(t, employeeId, employeeEmail)
                  ? () => onCheckInOut(t)
                  : undefined
              }
              onViewInfo={onViewInfo ? () => onViewInfo(t) : undefined}
              requestActions={
                onAcceptRequest && onRescheduleRequest && isAssignmentRequestTask(t, employeeId, employeeEmail)
                  ? {
                      sending: sendingAction,
                      startRescheduleOpen: rescheduleTaskId === t.id,
                      onAccept: () => onAcceptRequest(t),
                      onReschedule: (reason) => onRescheduleRequest(t, reason),
                    }
                  : undefined
              }
            />
          ))}
        </div>
      </EmpRecordHistorySheet>

      {showCreateFab && onCreateClick && (
        <button
          type="button"
          onClick={onCreateClick}
          className="mobile-fab fixed right-4 z-40 w-14 h-14 rounded-full bg-[#4f46e5] text-white shadow-lg flex items-center justify-center active:scale-90"
          style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}
          aria-label="New task"
        >
          <Plus className="w-6 h-6" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
