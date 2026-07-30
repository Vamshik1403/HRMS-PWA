"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { Megaphone, Plus } from "lucide-react";
import EmpMobileLayout from "../components/layout/EmpMobileLayout";
import { useEmpPortalDesktop } from "../components/layout/EmpPortalShell";
import { getPageCache, setPageCache } from "../utils/pageCache";
import { useEmpManagerScope } from "../hooks/useEmpManagerScope";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { splitPreviewRecords } from "../utils/empListLimit";
import { EmpRecordHistorySheet } from "../components/emp/EmpRecordHistorySheet";
import { EmpListViewMoreButton } from "../components/emp/EmpListViewMoreButton";
import { ManagerMemoComposeSheet } from "../components/emp/ManagerMemoComposeSheet";
import { ManagerMemoComposeInline } from "../components/emp/ManagerMemoComposeInline";
import { EmpDesktopPage } from "../components/emp/desktop/EmpDesktopPage";
import {
  EmpTeamStyleDataSection,
  useTeamListControls,
} from "../components/emp/desktop/EmpTeamStyleDataSection";
import { resolveAttachmentUrl } from "../utils/uploadFile";
import { useMemoChatPolling } from "../hooks/useMemoChatPolling";
import { Button } from "../components/ui/button";
import { cn } from "../utils/cn";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

interface MemoReply {
  id: number;
  description: string | null;
  issuedBy: string | null;
  createdAt: string | null;
  senderEmployeeId?: number | null;
}

interface Memo {
  id: number;
  subject: string | null;
  description: string | null;
  memoType: string | null;
  issuedDate: string | null;
  issuedBy: string | null;
  createdAt: string | null;
  attachmentPath?: string | null;
  replies?: MemoReply[];
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
  const isDesktop = useEmpPortalDesktop();
  const user = useCurrentUser();
  const { scope, isManagerView } = useEmpManagerScope();
  const [memos, setMemos] = useState<Memo[]>(() => getPageCache<Memo[]>("empMemos") ?? []);
  const [loading, setLoading] = useState(() => getPageCache<Memo[]>("empMemos") === null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replySaving, setReplySaving] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const employeeIDRef = useRef<number | null>(null);
  const listControls = useTeamListControls("emp-noticeboard-view");
  const {
    viewMode,
    selectViewMode,
    searchOpen,
    searchQuery,
    setSearchQuery,
    toggleSearch,
    filterOpen,
    toggleFilter,
  } = listControls;

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
      const filtered = data.filter(
        (m: { employeeID?: number; employeeIDs?: number[]; undoneAt?: string | null }) =>
          !m.undoneAt &&
          (m.employeeID === empId ||
            (Array.isArray(m.employeeIDs) && m.employeeIDs.includes(empId))),
      );
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
    window.dispatchEvent(new Event("emp-sidebar-badges-changed"));
    window.dispatchEvent(new Event("emp-notifications-changed"));

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
    }, 10000);
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
  const canSendNotice = isManagerView && directReportees.length > 0;

  const filteredMemos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return memos;
    return memos.filter((m) => {
      const subject = (m.subject || "").toLowerCase();
      const type = (m.memoType || "").toLowerCase();
      const issuedBy = (m.issuedBy || "").toLowerCase();
      const description = (m.description || "").toLowerCase();
      return (
        subject.includes(q) ||
        type.includes(q) ||
        issuedBy.includes(q) ||
        description.includes(q)
      );
    });
  }, [memos, searchQuery]);

  const memoAuthHeaders = useCallback((): Record<string, string> => {
    const token = localStorage.getItem("token");
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, []);

  const loadThread = useCallback(async (memoId: number) => {
    setThreadLoading(true);
    try {
      const r = await fetch(`${BACKEND}/employee-memo/${memoId}`, {
        headers: memoAuthHeaders(),
      });
      const data = await r.json();
      const replies = Array.isArray(data?.replies) ? data.replies : [];
      setMemos((prev) =>
        prev.map((m) => (m.id === memoId ? { ...m, replies } : m)),
      );
    } catch {
      /* ignore */
    } finally {
      setThreadLoading(false);
    }
  }, [memoAuthHeaders]);

  useMemoChatPolling<{ replies?: MemoReply[] }>(
    expandedId,
    (data) => {
      const replies = Array.isArray(data?.replies) ? data.replies : [];
      setMemos((prev) =>
        prev.map((m) => (m.id === expandedId ? { ...m, replies } : m)),
      );
    },
    expandedId != null,
    2000,
    memoAuthHeaders,
  );

  const toggleExpanded = (memoId: number) => {
    setExpandedId((cur) => {
      const next = cur === memoId ? null : memoId;
      if (next != null) void loadThread(next);
      return next;
    });
    setReplyText("");
  };

  const sendReply = async (memoId: number) => {
    if (!replyText.trim() || !employeeIDRef.current) return;
    setReplySaving(true);
    try {
      const token = localStorage.getItem("token");
      const r = await fetch(`${BACKEND}/employee-memo/${memoId}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: replyText.trim(),
          issuedBy: user?.username || "Employee",
          senderEmployeeId: employeeIDRef.current,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      setReplyText("");
      await loadThread(memoId);
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setReplySaving(false);
    }
  };

  const undoReply = async (memoId: number, replyId: number) => {
    try {
      const token = localStorage.getItem("token");
      const qs = employeeIDRef.current
        ? `?senderEmployeeId=${employeeIDRef.current}`
        : "";
      const r = await fetch(`${BACKEND}/employee-memo/${replyId}/undo${qs}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) throw new Error(await r.text());
      await loadThread(memoId);
    } catch (e: unknown) {
      console.error(e);
    }
  };

  const canUndoReply = (rep: MemoReply) => {
    if (!rep.createdAt || !employeeIDRef.current) return false;
    if (rep.senderEmployeeId != null && rep.senderEmployeeId !== employeeIDRef.current) {
      return false;
    }
    return Date.now() - new Date(rep.createdAt).getTime() < 30 * 60 * 1000;
  };

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
          onClick={() => toggleExpanded(memo.id)}
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
            {memo.attachmentPath && (
              <div className="pt-2">
                <a
                  href={resolveAttachmentUrl(memo.attachmentPath)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#eef2ff] text-[#2563eb] text-[13px] font-semibold active:scale-[0.98]"
                >
                  <Icon icon="solar:paperclip-2-bold-duotone" className="w-4 h-4" />
                  Open attachment
                </a>
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

            <div className="pt-3 space-y-2 border-t border-gray-100">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Conversation</p>
              {threadLoading && expandedId === memo.id ? (
                <p className="text-[12px] text-gray-400">Loading messages…</p>
              ) : (
                <>
                  {(memo.replies ?? []).map((rep) => (
                    <div key={rep.id} className="rounded-xl bg-gray-50 px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[12px] font-semibold text-gray-800">{rep.issuedBy || "User"}</p>
                        {canUndoReply(rep) && (
                          <button
                            type="button"
                            className="text-[10px] font-semibold text-[#2563eb]"
                            onClick={() => void undoReply(memo.id, rep.id)}
                          >
                            Undo
                          </button>
                        )}
                      </div>
                      <p className="text-[13px] text-gray-700 mt-1 whitespace-pre-line">{rep.description}</p>
                    </div>
                  ))}
                </>
              )}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={expandedId === memo.id ? replyText : ""}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Reply to admin…"
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-[13px]"
                />
                <button
                  type="button"
                  disabled={replySaving || !replyText.trim()}
                  onClick={() => void sendReply(memo.id)}
                  className="shrink-0 rounded-xl bg-[#2563eb] text-white px-4 py-2 text-[13px] font-semibold disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const noticeTable = (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="px-4 py-3 font-medium text-muted-foreground">Subject</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Type</th>
              <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                Issued by
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Date</th>
              <th className="px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">
                Attachment
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredMemos.map((memo) => {
              const colorClass = memoColor(memo.memoType);
              return (
                <tr
                  key={memo.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                  onClick={() => toggleExpanded(memo.id)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{memo.subject || "Notice"}</p>
                    {expandedId === memo.id && memo.description ? (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-3 whitespace-pre-line">
                        {memo.description}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {memo.memoType ? (
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                          colorClass,
                        )}
                      >
                        {memo.memoType}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {memo.issuedBy || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {fmt(memo.createdAt || memo.issuedDate)}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {memo.attachmentPath ? (
                      <a
                        href={resolveAttachmentUrl(memo.attachmentPath)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary font-semibold hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {expandedId != null ? (
        <div className="border-t border-border bg-muted/20 px-4 py-4 space-y-3">
          {(() => {
            const memo = filteredMemos.find((m) => m.id === expandedId) ??
              memos.find((m) => m.id === expandedId);
            if (!memo) return null;
            return (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">
                    Conversation · {memo.subject || "Notice"}
                  </p>
                  <button
                    type="button"
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                    onClick={() => setExpandedId(null)}
                  >
                    Close
                  </button>
                </div>
                {threadLoading ? (
                  <p className="text-xs text-muted-foreground">Loading messages…</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {(memo.replies ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">No replies yet.</p>
                    ) : (
                      (memo.replies ?? []).map((rep) => (
                        <div
                          key={rep.id}
                          className="rounded-lg bg-card border border-border px-3 py-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-semibold text-foreground">
                              {rep.issuedBy || "User"}
                            </p>
                            {canUndoReply(rep) ? (
                              <button
                                type="button"
                                className="text-[10px] font-semibold text-primary"
                                onClick={() => void undoReply(memo.id, rep.id)}
                              >
                                Undo
                              </button>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">
                            {rep.description}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Reply…"
                    className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm"
                  />
                  <Button
                    type="button"
                    disabled={replySaving || !replyText.trim()}
                    onClick={() => void sendReply(memo.id)}
                  >
                    Send
                  </Button>
                </div>
              </>
            );
          })()}
        </div>
      ) : null}
    </div>
  );

  const noticeGrid = (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {filteredMemos.map((memo) => {
        const colorClass = memoColor(memo.memoType);
        return (
          <button
            key={memo.id}
            type="button"
            onClick={() => toggleExpanded(memo.id)}
            className="rounded-xl border border-border bg-card shadow-sm p-4 text-left hover:border-primary/40 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                  colorClass,
                )}
              >
                <Icon icon={memoIcon(memo.memoType)} className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground line-clamp-2">
                  {memo.subject || "Notice"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {fmt(memo.createdAt || memo.issuedDate)}
                  {memo.issuedBy ? ` · ${memo.issuedBy}` : ""}
                </p>
                {memo.memoType ? (
                  <span
                    className={cn(
                      "mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                      colorClass,
                    )}
                  >
                    {memo.memoType}
                  </span>
                ) : null}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  const desktopBody = composeOpen ? (
    <ManagerMemoComposeInline
      open={composeOpen}
      onOpenChange={setComposeOpen}
      managerName={managerName || undefined}
      onSent={() => {
        if (employeeIDRef.current) void loadMemos(employeeIDRef.current);
      }}
    />
  ) : (
    <EmpTeamStyleDataSection
      title="Notices"
      actions={
        canSendNotice ? (
          <Button type="button" size="sm" onClick={() => setComposeOpen(true)}>
            <Plus className="size-4" />
            Send notice
          </Button>
        ) : null
      }
      searchOpen={searchOpen}
      onToggleSearch={toggleSearch}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Search notices…"
      filterOpen={filterOpen}
      onToggleFilter={toggleFilter}
      viewMode={viewMode}
      onViewModeChange={selectViewMode}
      loading={loading}
      empty={filteredMemos.length === 0}
      emptyMessage={
        searchQuery.trim()
          ? `No notices match "${searchQuery.trim()}".`
          : isManagerView
            ? "No notices yet. Send a notice or warning to your team."
            : "No notices yet."
      }
      listContent={noticeTable}
      gridContent={noticeGrid}
    />
  );

  const memoListBody = loading ? (
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
  );

  return (
    <EmpMobileLayout>
      {isDesktop ? (
        <EmpDesktopPage
          title="Noticeboard"
          description="Notices, warnings, and conversations with your team"
          icon={Megaphone}
        >
          {desktopBody}
        </EmpDesktopPage>
      ) : (
        <div className="px-4 pt-5 pb-6 space-y-4">
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center active:scale-[0.92]"
            >
              <Icon icon="solar:arrow-left-linear" className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-[22px] font-bold text-gray-900">Internal Messaging (IM)</h1>
          </div>
          {memoListBody}
        </div>
      )}

      <EmpRecordHistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Notice history"
        subtitle={`${history.length} older notice(s)`}
      >
        <div className="space-y-3">{history.map(renderMemo)}</div>
      </EmpRecordHistorySheet>

      {isManagerView && directReportees.length > 0 && !isDesktop && (
        <>
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="fixed right-4 z-40 w-14 h-14 rounded-full bg-[#2563eb] text-white shadow-lg flex items-center justify-center active:scale-90"
            style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}
            aria-label="Send notice"
          >
            <Plus className="w-6 h-6" strokeWidth={2.5} />
          </button>
          <ManagerMemoComposeSheet
            open={composeOpen}
            onClose={() => setComposeOpen(false)}
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
