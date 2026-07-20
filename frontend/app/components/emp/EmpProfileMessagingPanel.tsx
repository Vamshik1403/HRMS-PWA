"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { authHeaders } from "@/lib/auth";

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

export function EmpProfileMessagingPanel() {
  const user = useCurrentUser();
  const [messages, setMessages] = useState<MemoItem[]>([]);
  const [loading, setLoading] = useState(true);

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
      const data = await fetch(`${BACKEND}/employee-memo`, { headers: authHeaders() }).then((r) =>
        r.ok ? r.json() : [],
      );
      const list = (Array.isArray(data) ? data : []).filter(
        (m: { employeeID?: number; employeeIDs?: number[]; undoneAt?: string | null; memoType?: string }) =>
          !m.undoneAt &&
          (m.employeeID === empId ||
            (Array.isArray(m.employeeIDs) && m.employeeIDs.includes(empId))) &&
          (m.memoType || "General") === "General",
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

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">Internal messaging</h3>
        <p className="text-sm text-muted-foreground">Team communications and general messages</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Loading messages…</p>
      ) : messages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          No internal messages yet.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
          {messages.map((m) => (
            <li key={m.id} className="px-4 py-4 hover:bg-muted/30">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                  <Icon icon="solar:bell-bold-duotone" className="size-5 text-violet-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground truncate">
                    {m.subject || m.title || "Message"}
                  </p>
                  {m.description ? (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{m.description}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground mt-2">
                    {fmt(m.createdAt || m.issuedDate)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
