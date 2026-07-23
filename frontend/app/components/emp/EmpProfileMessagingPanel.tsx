"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { Plus } from "lucide-react";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { useEmpManagerScope } from "@/app/hooks/useEmpManagerScope";
import { authHeaders } from "@/lib/auth";
import { Button } from "../ui/button";
import { ManagerMemoComposeInline } from "./ManagerMemoComposeInline";
import { EmpTeamStyleDataSection, useTeamListControls } from "./desktop/EmpTeamStyleDataSection";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

type MemoItem = {
  id: number;
  subject?: string | null;
  title?: string | null;
  description?: string | null;
  memoType?: string | null;
  createdAt?: string | null;
  issuedDate?: string | null;
};

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function messageTitle(m: MemoItem) {
  return m.subject || m.title || "Message";
}

function MessagingTable({ rows }: { rows: MemoItem[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="px-4 py-3 font-medium text-muted-foreground">Subject</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Message</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{messageTitle(m)}</td>
                <td className="px-4 py-3 text-muted-foreground max-w-md truncate">
                  {m.description || "—"}
                </td>
                <td className="px-4 py-3 tabular-nums">{fmt(m.createdAt || m.issuedDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MessagingGrid({ rows }: { rows: MemoItem[] }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {rows.map((m) => (
        <div
          key={m.id}
          className="rounded-xl border border-border bg-card shadow-sm p-4 hover:border-primary/40 transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
              <Icon icon="solar:bell-bold-duotone" className="size-5 text-violet-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground truncate">{messageTitle(m)}</p>
              {m.description ? (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{m.description}</p>
              ) : null}
              <p className="text-xs text-muted-foreground mt-2">{fmt(m.createdAt || m.issuedDate)}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmpProfileMessagingPanel() {
  const user = useCurrentUser();
  const { isManagerView } = useEmpManagerScope();
  const [messages, setMessages] = useState<MemoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const listControls = useTeamListControls("emp-profile-im-view");
  const { viewMode, selectViewMode, searchOpen, searchQuery, setSearchQuery, toggleSearch } = listControls;

  const canCompose = isManagerView;

  const load = useCallback(async () => {
    if (!user?.username) return;
    setLoading(true);
    try {
      const creds = await fetch(
        `${BACKEND}/manage-emp/credentials/${encodeURIComponent(user.username)}`,
        { headers: authHeaders() },
      ).then((r) => (r.ok ? r.json() : null));
      const empId = creds?.employee?.id;
      if (!empId) {
        setMessages([]);
        return;
      }
      const data = await fetch(`${BACKEND}/employee-memo?employeeID=${empId}`, {
        headers: authHeaders(),
      }).then((r) => (r.ok ? r.json() : []));
      const list = (Array.isArray(data) ? data : []).filter(
        (m: { undoneAt?: string | null; memoType?: string }) =>
          !m.undoneAt && (m.memoType || "General") === "General",
      );
      list.sort(
        (a: MemoItem, b: MemoItem) =>
          new Date(b.createdAt || b.issuedDate || 0).getTime() -
          new Date(a.createdAt || a.issuedDate || 0).getTime(),
      );
      setMessages(list);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [user?.username]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(
      (m) =>
        messageTitle(m).toLowerCase().includes(q) ||
        (m.description || "").toLowerCase().includes(q) ||
        (m.memoType || "").toLowerCase().includes(q),
    );
  }, [messages, searchQuery]);

  return (
    <div className="space-y-4">
      <ManagerMemoComposeInline
        open={composeOpen}
        onOpenChange={setComposeOpen}
        managerName={user?.username || "Manager"}
        onSent={() => {
          setComposeOpen(false);
          void load();
        }}
      />

      {!composeOpen ? (
        <EmpTeamStyleDataSection
          title="Internal messaging"
          actions={
            canCompose ? (
              <Button type="button" size="sm" onClick={() => setComposeOpen(true)}>
                <Plus className="size-4" />
                Send IM
              </Button>
            ) : undefined
          }
          searchOpen={searchOpen}
          onToggleSearch={toggleSearch}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search messages…"
          viewMode={viewMode}
          onViewModeChange={selectViewMode}
          loading={loading}
          empty={filtered.length === 0}
          emptyMessage={searchQuery.trim() ? "No messages match your search." : "No internal messages yet."}
          listContent={<MessagingTable rows={filtered} />}
          gridContent={<MessagingGrid rows={filtered} />}
        />
      ) : null}
    </div>
  );
}
