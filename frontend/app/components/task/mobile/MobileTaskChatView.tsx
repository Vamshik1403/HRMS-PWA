"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { CheckCheck, MoreVertical, Paperclip, Send, X } from "lucide-react";
import { TaskStatusBadge } from "../task-ui";
import { TaskChatAttachmentImage } from "../TaskChatAttachment";
import { taskAttachmentSrc, uploadTaskAttachment } from "../../../utils/taskAttachment";
import { toast } from "sonner";
import type { SitePunchKind, SitePunchEvent } from "../../../utils/taskSitePunch";
import { nextTaskStatus } from "../../../utils/taskStatusFlow";
import {
  formatSitePunchAt,
  isSitePunchTaskType,
  sitePunchMenuLabel,
  sitePunchesFromTask,
} from "../../../utils/taskSitePunch";
import { isEnplLinkedTask, type TaskWithSiteVisits } from "../../../utils/taskSiteVisit";
import { TaskSiteVisitSummary } from "./TaskSiteVisitPanel";

export interface MobileChatMessage {
  id: number;
  message: string;
  senderName?: string;
  employeeID?: number | null;
  userID?: number | null;
  attachmentUrl?: string | null;
  createdAt: string;
}

export interface MobileTaskChatDetail {
  id: number;
  taskCode: string;
  taskName: string;
  taskType?: string;
  status: string;
  priority: string;
  description?: string | null;
  scheduleDateTime?: string | null;
  dueDateTime?: string | null;
  dueAt?: string | null;
  erpTaskId?: number | null;
  expectedDurationMinutes?: number | null;
  siteAddress?: string | null;
  siteCity?: string | null;
  siteVisits?: TaskWithSiteVisits["siteVisits"];
  siteVisitSummary?: TaskWithSiteVisits["siteVisitSummary"];
  customer?: { customerName?: string };
  site?: { branchName?: string; city?: string; address?: string };
  department?: { departmentName?: string };
  chats?: MobileChatMessage[];
  sitePunches?: SitePunchEvent[];
  assignments?: { manageEmployee?: { employeeFirstName?: string; employeeLastName?: string; employeeID?: string } }[];
}

function formatBubbleTime(value: string) {
  try {
    return new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatDayLabel(value: string) {
  try {
    const d = new Date(value);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

function isSameSender(a?: string, b?: string) {
  return (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
}

export function MobileTaskChatView({
  task,
  currentUserName,
  currentEmployeeId,
  message,
  onMessageChange,
  onSend,
  sending,
  onBack,
  onAdvanceStatus,
  onSitePunch,
  sitePunchNextKind = "in",
  onEnplSiteVisit,
  onDownloadReport,
  embedded = false,
}: {
  task: MobileTaskChatDetail;
  currentUserName?: string;
  /** Prefer employee DB id for own-message detection (senderName can differ from login username). */
  currentEmployeeId?: number;
  message: string;
  onMessageChange: (v: string) => void;
  onSend: (payload: { message: string; attachmentUrl?: string }) => void | Promise<void>;
  sending?: boolean;
  onBack: () => void;
  onAdvanceStatus?: () => void | Promise<void>;
  onSitePunch?: () => void | Promise<void>;
  sitePunchNextKind?: SitePunchKind;
  onEnplSiteVisit?: (kind: "checkin" | "checkout") => void | Promise<void>;
  onDownloadReport?: () => void | Promise<void>;
  /** When true, fill the parent instead of the full viewport (desktop portal). */
  embedded?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const chats = task.chats || [];
  const me = (currentUserName || "").trim().toLowerCase();
  const canSend = (message.trim() || pendingAttachment) && !sending && !uploading;
  const previewSrc = taskAttachmentSrc(pendingAttachment);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chats.length, chats[chats.length - 1]?.id, sending]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadTaskAttachment(file);
      setPendingAttachment(url);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSend = () => {
    if (!canSend) return;
    setJustSent(true);
    onSend({ message: message.trim(), attachmentUrl: pendingAttachment || undefined });
    setPendingAttachment(null);
    setTimeout(() => setJustSent(false), 400);
  };

  let lastDay = "";

  return (
    <div className={embedded ? "flex flex-col h-full min-h-[560px] rounded-xl border border-border overflow-hidden bg-[#f0f2f5]" : "flex flex-col h-[100dvh] bg-[#f0f2f5]"}>
      <header className="mobile-chat-header sticky top-0 z-20 shrink-0 bg-white/90 backdrop-blur-xl border-b border-gray-200/60 px-2 pt-1 pb-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-700 active:bg-gray-100 transition-colors"
            aria-label="Back"
          >
            <Icon icon="solar:arrow-left-linear" className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1 px-1">
            <p className="text-[16px] font-semibold text-gray-900 truncate leading-tight">{task.taskName}</p>
            <p className="text-[11px] font-mono text-gray-400 truncate">{task.taskCode}</p>
          </div>
          <TaskStatusBadge status={task.status} size="xs" className="shrink-0 !rounded-full mr-0.5" />
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="w-10 h-10 rounded-full flex items-center justify-center text-gray-600 active:bg-gray-100"
              aria-label="Menu"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-40 w-48 rounded-xl bg-white shadow-lg border border-gray-100 py-1 overflow-hidden">
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2.5 text-[13px] text-gray-700 active:bg-gray-50"
                    onClick={() => { setInfoOpen(true); setMenuOpen(false); }}
                  >
                    View Task info
                  </button>
                  {onDownloadReport && (
                    <button
                      type="button"
                      className="w-full text-left px-4 py-2.5 text-[13px] text-gray-700 active:bg-gray-50"
                      onClick={() => { setMenuOpen(false); void onDownloadReport(); }}
                    >
                      Download report (PDF)
                    </button>
                  )}
                  {isEnplLinkedTask(task) && onEnplSiteVisit ? (
                    <>
                      <button
                        type="button"
                        className="w-full text-left px-4 py-2.5 text-[13px] text-[#2563eb] active:bg-gray-50"
                        onClick={() => { setMenuOpen(false); void onEnplSiteVisit("checkin"); }}
                      >
                        Site check in
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-4 py-2.5 text-[13px] text-[#2563eb] active:bg-gray-50"
                        onClick={() => { setMenuOpen(false); void onEnplSiteVisit("checkout"); }}
                      >
                        Site check out
                      </button>
                    </>
                  ) : isSitePunchTaskType(task.taskType) && onSitePunch ? (
                    <button
                      type="button"
                      className="w-full text-left px-4 py-2.5 text-[13px] text-[#2563eb] active:bg-gray-50"
                      onClick={() => { setMenuOpen(false); void onSitePunch(); }}
                    >
                      {sitePunchMenuLabel(sitePunchNextKind)}
                    </button>
                  ) : null}
                  {onAdvanceStatus && nextTaskStatus(task.status) && (
                    <button
                      type="button"
                      className="w-full text-left px-4 py-2.5 text-[13px] text-gray-700 active:bg-gray-50"
                      onClick={() => { setMenuOpen(false); void onAdvanceStatus(); }}
                    >
                      Set to {nextTaskStatus(task.status)}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="mobile-chat-bg flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-1">
        {isEnplLinkedTask(task) ? (
          <div className="mb-3">
            <TaskSiteVisitSummary
              task={task}
              allowActions={!!onEnplSiteVisit}
              sending={sending}
              onCheckIn={onEnplSiteVisit ? () => void onEnplSiteVisit("checkin") : undefined}
              onCheckOut={onEnplSiteVisit ? () => void onEnplSiteVisit("checkout") : undefined}
            />
          </div>
        ) : null}
        {chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-white/80 flex items-center justify-center mb-3 shadow-sm">
              <Icon icon="solar:chat-round-dots-linear" className="w-7 h-7 text-[#4f46e5]/60" />
            </div>
            <p className="text-[14px] font-medium text-gray-600">No messages yet</p>
            <p className="text-[12px] text-gray-400 mt-1 max-w-[200px]">Send a remark to start the discussion</p>
          </div>
        ) : (
          chats.map((c, idx) => {
            const own =
              (currentEmployeeId != null && c.employeeID != null && c.employeeID === currentEmployeeId) ||
              isSameSender(c.senderName, currentUserName) ||
              (me && (c.senderName || "").trim().toLowerCase() === me);
            const day = formatDayLabel(c.createdAt);
            const showDay = day !== lastDay;
            if (showDay) lastDay = day;
            const prev = chats[idx - 1];
            const showName = !own && (!prev || !isSameSender(prev.senderName, c.senderName) || formatDayLabel(prev.createdAt) !== day);
            const showText = c.message && c.message !== "📷 Photo";

            return (
              <div key={c.id}>
                {showDay && (
                  <div className="flex justify-center my-3">
                    <span className="text-[11px] font-medium text-gray-500 bg-white/70 backdrop-blur px-3 py-1 rounded-full shadow-sm">
                      {day}
                    </span>
                  </div>
                )}
                <div className={`flex ${own ? "justify-end" : "justify-start"} mb-0.5 mobile-msg-enter`}>
                  <div className={`max-w-[82%] ${own ? "items-end" : "items-start"} flex flex-col`}>
                    {showName && (
                      <span className="text-[11px] font-medium text-[#4f46e5] mb-0.5 ml-1">{c.senderName || "User"}</span>
                    )}
                    <div
                      className={`relative px-2.5 py-2 rounded-2xl shadow-sm ${
                        own
                          ? "bg-[#dcf8c6] rounded-br-md border border-[#c5e8b8]/50"
                          : "bg-white rounded-bl-md border border-gray-100/90"
                      } ${justSent && idx === chats.length - 1 && own ? "mobile-msg-sent-pop" : ""}`}
                    >
                      {showText && (
                        <p className="text-[14px] text-gray-900 leading-snug whitespace-pre-wrap break-words px-0.5">{c.message}</p>
                      )}
                      <TaskChatAttachmentImage attachmentUrl={c.attachmentUrl} className={showText ? "" : ""} />
                      <div className={`flex items-center gap-1 mt-0.5 px-0.5 ${own ? "justify-end" : "justify-start"}`}>
                        <span className="text-[10px] text-gray-500">{formatBubbleTime(c.createdAt)}</span>
                        {own && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" strokeWidth={2.5} />}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mobile-chat-composer shrink-0 bg-[#f0f2f5] px-2 pt-1.5 pb-2 border-t border-gray-200/40" style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
        {previewSrc && (
          <div className="flex items-center gap-2 px-1 pb-2">
            <div className="relative">
              <img src={previewSrc} alt="Preview" className="h-14 w-14 rounded-xl object-cover border border-gray-200" />
              <button
                type="button"
                onClick={() => setPendingAttachment(null)}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gray-800 text-white flex items-center justify-center"
                aria-label="Remove"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <span className="text-[12px] text-gray-500">Image ready to send</span>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || sending}
            className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-gray-500 active:bg-gray-200/60 transition-colors disabled:opacity-50"
            aria-label="Attach image"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0 rounded-3xl bg-white border border-gray-200/80 shadow-sm flex items-end overflow-hidden mobile-input-focus-ring">
            <textarea
              ref={inputRef}
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              placeholder="Message"
              rows={1}
              className="flex-1 max-h-24 min-h-[40px] py-2.5 px-4 text-[15px] bg-transparent resize-none focus:outline-none leading-snug"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="mobile-send-btn w-11 h-11 shrink-0 rounded-full bg-[#4f46e5] text-white flex items-center justify-center shadow-lg shadow-[#4f46e5]/30 disabled:opacity-40 active:scale-90 transition-transform duration-150"
            aria-label="Send"
          >
            <Send className="w-5 h-5 ml-0.5" />
          </button>
        </div>
      </div>

      {infoOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 mobile-sheet-backdrop" onClick={() => setInfoOpen(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 mobile-sheet-up rounded-t-2xl bg-white max-h-[70vh] overflow-y-auto" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mt-3 mb-4" />
            <div className="px-5 pb-6 space-y-3">
              <h3 className="text-[17px] font-semibold text-gray-900">Task info</h3>
              {[
                ["Customer", task.customer?.customerName],
                ["Site", task.site?.branchName || task.site?.city],
                ["Type", task.taskType],
                ["Schedule", task.scheduleDateTime ? new Date(task.scheduleDateTime).toLocaleString("en-IN") : "—"],
                ["Due date & time", (task.dueAt || task.dueDateTime) ? new Date(String(task.dueAt || task.dueDateTime)).toLocaleString("en-IN") : "—"],
                ["Priority", task.priority],
                ["Status", task.status],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between gap-4 py-2 border-b border-gray-50 last:border-0">
                  <span className="text-[13px] text-gray-500">{label}</span>
                  <span className="text-[13px] font-medium text-gray-900 text-right">{val || "—"}</span>
                </div>
              ))}
              {task.description && (
                <div className="pt-2">
                  <p className="text-[12px] text-gray-500 mb-1">Details</p>
                  <p className="text-[13px] text-gray-800 leading-relaxed">{task.description}</p>
                </div>
              )}
              {isEnplLinkedTask(task) ? (
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-[12px] font-bold text-gray-400 uppercase mb-2">Site visit</p>
                  <TaskSiteVisitSummary task={task} compact />
                </div>
              ) : isSitePunchTaskType(task.taskType) ? (
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-[12px] font-bold text-gray-400 uppercase mb-2">Site check-in / check-out</p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {sitePunchesFromTask(task).map((p, i) => (
                      <div key={`${p.kind}-${p.at}-${i}`} className="text-[11px] bg-gray-50 rounded-lg px-2 py-1.5">
                        <span className="font-semibold text-gray-700">
                          {p.kind === "in" ? "Site check in" : "Site check out"}
                        </span>
                        {p.employeeName ? (
                          <span className="text-gray-500 ml-1">{p.employeeName}</span>
                        ) : null}
                        <span className="text-gray-400 ml-1">{formatSitePunchAt(p.at)}</span>
                      </div>
                    ))}
                    {sitePunchesFromTask(task).length === 0 && (
                      <p className="text-[12px] text-gray-400">No check-in/out logged yet</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
