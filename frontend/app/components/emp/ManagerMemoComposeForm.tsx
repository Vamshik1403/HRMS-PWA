"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { reporteeDisplayName, type EmpManagerReportee } from "../../utils/empManagerDisplay";
import { uploadAttachmentFile } from "../../utils/uploadFile";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { cn } from "@/app/utils/cn";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";
const MIN_SEARCH_CHARS = 1;
const DEBOUNCE_MS = 300;

type EmployeeOption = EmpManagerReportee;

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
      : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function employeeLabel(employee: EmployeeOption): string {
  return reporteeDisplayName(employee);
}

function matchesEmployeePrefix(employee: EmployeeOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;

  const first = (employee.employeeFirstName ?? "").toLowerCase();
  const last = (employee.employeeLastName ?? "").toLowerCase();
  const full = `${first} ${last}`.trim();
  const employeeId = (employee.employeeID ?? "").toLowerCase();

  return (
    first.startsWith(q) ||
    last.startsWith(q) ||
    full.startsWith(q) ||
    employeeId.startsWith(q) ||
    full.split(/\s+/).some((part) => part.startsWith(q))
  );
}

function EmployeeRecipientPicker({
  selected,
  onChange,
  companyId,
  excludeEmployeeId,
}: {
  selected: EmployeeOption[];
  onChange: (next: EmployeeOption[]) => void;
  companyId: number | null;
  excludeEmployeeId?: number | null;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<EmployeeOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const employeesCacheRef = useRef<EmployeeOption[] | null>(null);

  const loadCompanyEmployees = useCallback(async () => {
    if (!companyId) return [];
    if (employeesCacheRef.current) return employeesCacheRef.current;

    const res = await fetch(`${BACKEND}/manage-emp`, {
      headers: authHeaders(),
      cache: "no-store",
      signal: abortRef.current?.signal,
    });
    if (!res.ok) return [];

    const data = await res.json();
    const list = (Array.isArray(data) ? data : [])
      .filter((row: { companyID?: number; id?: number }) => Number(row.companyID) === Number(companyId))
      .filter((row: { id?: number }) => row.id !== excludeEmployeeId)
      .map((row: EmployeeOption) => ({
        id: Number(row.id),
        employeeID: row.employeeID,
        employeeFirstName: row.employeeFirstName,
        employeeLastName: row.employeeLastName,
      }));

    employeesCacheRef.current = list;
    return list;
  }, [companyId, excludeEmployeeId]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < MIN_SEARCH_CHARS || !companyId) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      void loadCompanyEmployees()
        .then((employees) => {
          if (ctrl.signal.aborted) return;
          const selectedIds = new Set(selected.map((item) => item.id));
          const filtered = employees
            .filter((employee) => !selectedIds.has(employee.id))
            .filter((employee) => matchesEmployeePrefix(employee, trimmed))
            .slice(0, 15);
          setSuggestions(filtered);
        })
        .catch(() => {
          if (!ctrl.signal.aborted) setSuggestions([]);
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setSearching(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, companyId, selected, loadCompanyEmployees]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setSuggestions([]);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const addRecipient = (employee: EmployeeOption) => {
    if (selected.some((item) => item.id === employee.id)) return;
    onChange([...selected, employee]);
    setQuery("");
    setSuggestions([]);
    setOpen(false);
  };

  const removeRecipient = (id: number) => {
    onChange(selected.filter((item) => item.id !== id));
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        className={cn(
          "flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1.5",
          open && "ring-2 ring-primary/20",
        )}
        onClick={() => setOpen(true)}
      >
        {selected.map((employee) => (
          <span
            key={employee.id}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
          >
            {employeeLabel(employee)}
            <button
              type="button"
              aria-label={`Remove ${employeeLabel(employee)}`}
              onClick={(event) => {
                event.stopPropagation();
                removeRecipient(employee.id);
              }}
              className="rounded-full p-0.5 hover:bg-primary/20"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? "Search employee name or ID…" : "Add another employee…"}
          autoComplete="off"
          className="min-w-[140px] flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {open && query.trim().length >= MIN_SEARCH_CHARS ? (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
          {searching ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
          ) : suggestions.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">No matching employees</p>
          ) : (
            suggestions.map((employee) => (
              <button
                key={employee.id}
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/50"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => addRecipient(employee)}
              >
                <span className="font-medium text-foreground">{employeeLabel(employee)}</span>
                {employee.employeeID ? (
                  <span className="text-xs text-muted-foreground">{employee.employeeID}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ManagerMemoComposeForm({
  managerName,
  onSent,
}: {
  managerName?: string;
  onSent: () => void;
  onCancel?: () => void;
}) {
  const user = useCurrentUser();
  const [selectedRecipients, setSelectedRecipients] = useState<EmployeeOption[]>([]);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [currentEmployeeId, setCurrentEmployeeId] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  useEffect(() => {
    if (!user?.username) return;
    fetch(`${BACKEND}/manage-emp/credentials/${encodeURIComponent(user.username)}`, {
      headers: authHeaders(),
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((creds) => {
        setCompanyId(creds?.companyID ?? null);
        setCurrentEmployeeId(creds?.employee?.id ?? null);
      })
      .catch(() => {
        setCompanyId(null);
        setCurrentEmployeeId(null);
      });
  }, [user?.username]);

  const submit = async () => {
    if (selectedRecipients.length === 0) {
      toast.error("Select at least one recipient");
      return;
    }
    if (!subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    setSending(true);
    try {
      let attachmentPath: string | undefined;
      if (attachmentFile) {
        attachmentPath = await uploadAttachmentFile(attachmentFile);
      }
      const res = await fetch(`${BACKEND}/employee-memo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          employeeIDs: selectedRecipients.map((recipient) => recipient.id),
          memoType: "General",
          subject: subject.trim(),
          description: description.trim() || undefined,
          issuedDate: new Date().toISOString().slice(0, 10),
          issuedBy: managerName || "Manager",
          issuedByRole: "MANAGER",
          attachmentPath,
        }),
      });
      if (!res.ok) throw new Error("Send failed");
      const data = await res.json();
      const created = Array.isArray(data) ? data[0] : data;
      if (!created?.id) throw new Error("No message was created");
      toast.success("Message sent");
      setSubject("");
      setDescription("");
      setSelectedRecipients([]);
      setAttachmentFile(null);
      onSent();
    } catch {
      toast.error("Could not send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>To</Label>
        <EmployeeRecipientPicker
          selected={selectedRecipients}
          onChange={setSelectedRecipients}
          companyId={companyId}
          excludeEmployeeId={currentEmployeeId}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="memo-subject">Subject</Label>
        <Input
          id="memo-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="memo-message">Message</Label>
        <Textarea
          id="memo-message"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="memo-attachment">Attachment</Label>
        <Input
          id="memo-attachment"
          type="file"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <Button type="button" onClick={() => void submit()} disabled={sending}>
          {sending ? "Sending…" : "Send message"}
        </Button>
      </div>
    </div>
  );
}
