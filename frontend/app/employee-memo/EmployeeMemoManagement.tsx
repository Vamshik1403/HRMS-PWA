"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Plus, Search, Edit, Trash2, Eye, X } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { getSidebarContext } from "../utils/sidebarContext";
import { toast } from "sonner";
import { FormDrawer } from "../components/ui/form-drawer";
import { isDesktopManagerFlagSet } from "@/lib/desktopManager";
import { resolveAttachmentUrl, uploadAttachmentFile } from "../utils/uploadFile";

const API = "/backend/employee-memo";
const EMP_API = "/backend/manage-emp";

interface MemoRow {
  id: number;
  employeeID: number;
  companyID?: number;
  memoType?: string;
  subject?: string;
  description?: string;
  issuedDate?: string;
  issuedBy?: string;
  createdAt?: string;
  attachmentPath?: string | null;
  manageEmployee?: {
    id: number;
    companyID?: number;
    employeeFirstName?: string;
    employeeLastName?: string;
    employeeID?: string;
  };
}

interface SelectedEmp { id: number; label: string; }

export function EmployeeMemoManagement() {
  const user = useCurrentUser();
  const canManage =
    user?.role === "SUPERADMIN" ||
    user?.role === "SERVICE_PROVIDER" ||
    user?.role === "COMPANY_ADMIN" ||
    user?.role === "BRANCH_ADMIN" ||
    (user?.role === "EMPLOYEE" && isDesktopManagerFlagSet());

  const [replyText, setReplyText] = useState("");
  const [replySaving, setReplySaving] = useState(false);
  const [viewReplies, setViewReplies] = useState<MemoRow[]>([]);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const [rows, setRows] = useState<MemoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingRow, setEditingRow] = useState<MemoRow | null>(null);
  const [viewRow, setViewRow] = useState<MemoRow | null>(null);
  const [isViewing, setIsViewing] = useState(false);

  // Employee autocomplete shared state
  const [empSearch, setEmpSearch] = useState("");
  const [empList, setEmpList] = useState<any[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const empRef = useRef<HTMLDivElement>(null);
  const empTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Multi-select (add mode only)
  const [selectedEmployees, setSelectedEmployees] = useState<SelectedEmp[]>([]);

  const [form, setForm] = useState({
    employeeID: null as number | null,
    empAutocomplete: "",
    memoType: "",
    subject: "",
    description: "",
    issuedDate: new Date().toISOString().split("T")[0],
    issuedBy: "",
  });

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchRows = async () => {
    setLoading(true);
    try {
      const res = await fetch(API);
      const data = await res.json();
      let result = Array.isArray(data) ? data : data?.data ?? [];
      const getCompanyID = (r: any) => r.companyID ?? r.manageEmployee?.companyID;
      if (user?.role === "SUPERADMIN") {
        const ctx = getSidebarContext();
        if (ctx?.companyID) {
          result = result.filter((r: any) => Number(getCompanyID(r)) === Number(ctx.companyID));
        }
      } else if (user?.role === "SERVICE_PROVIDER") {
        const ctx = getSidebarContext();
        const companyID = ctx?.companyID ?? user?.companyID;
        if (companyID) result = result.filter((r: any) => Number(getCompanyID(r)) === Number(companyID));
      } else if (user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN") {
        const ctx = getSidebarContext();
        const companyID = ctx?.companyID ?? user?.companyID;
        if (companyID) result = result.filter((r: any) => Number(getCompanyID(r)) === Number(companyID));
      }
      setRows(result);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user) fetchRows(); }, [user]);

  useEffect(() => {
    const handler = () => fetchRows();
    window.addEventListener("sidebar-context-changed", handler);
    window.addEventListener("app-data-refresh", handler);
    return () => {
      window.removeEventListener("sidebar-context-changed", handler);
      window.removeEventListener("app-data-refresh", handler);
    };
  }, []);

  // ── Employee autocomplete ──────────────────────────────────────────────────
  const runFetchEmp = (q: string) => {
    if (empTimerRef.current) clearTimeout(empTimerRef.current);
    empTimerRef.current = setTimeout(async () => {
      if (q.length < 1) { setEmpList([]); return; }
      setEmpLoading(true);
      try {
        const res = await fetch(EMP_API);
        const raw = await res.json();
        let all = Array.isArray(raw) ? raw : raw?.data ?? [];
        const ctx = getSidebarContext();
        const companyID = ctx?.companyID ?? user?.companyID;
        if (companyID) all = all.filter((e: any) => e.companyID === companyID);
        const ql = q.toLowerCase();
        const filtered = all.filter((e: any) => {
          const name = `${e.employeeFirstName ?? ""} ${e.employeeLastName ?? ""}`.toLowerCase();
          const eid = (e.employeeID ?? "").toLowerCase();
          return name.includes(ql) || eid.includes(ql);
        });
        setEmpList(filtered.slice(0, 20));
      } catch {
        setEmpList([]);
      } finally {
        setEmpLoading(false);
      }
    }, 250);
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (empRef.current && !empRef.current.contains(e.target as Node)) setEmpList([]);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // ── Form helpers ───────────────────────────────────────────────────────────
  const resetForm = () => {
    setForm({
      employeeID: null,
      empAutocomplete: "",
      memoType: "",
      subject: "",
      description: "",
      issuedDate: new Date().toISOString().split("T")[0],
      issuedBy: user?.username ?? "",
    });
    setSelectedEmployees([]);
    setEmpSearch("");
    setEmpList([]);
    setEditingRow(null);
    setAttachmentFile(null);
  };

  const uploadSelectedAttachment = async (): Promise<string | null> => {
    if (!attachmentFile) return null;
    setUploadingAttachment(true);
    try {
      const url = await uploadAttachmentFile(attachmentFile);
      return url;
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingRow) {
      // Edit mode — single employee, unchanged behaviour
      if (!form.employeeID) { toast.error("Please select an employee"); return; }
      setSaving(true);
      try {
        const attachmentPath = await uploadSelectedAttachment();
        const payload = {
          employeeID: form.employeeID,
          memoType: form.memoType || null,
          subject: form.subject || null,
          description: form.description || null,
          issuedDate: form.issuedDate || null,
          issuedBy: form.issuedBy || null,
          issuedByRole: user?.role ?? undefined,
          attachmentPath,
        };
        const res = await fetch(`${API}/${editingRow.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
        toast.success("Memo updated");
        resetForm();
        setIsAddingNew(false);
        fetchRows();
      } catch (err: any) {
        toast.error(err?.message || "Failed to save");
      } finally {
        setSaving(false);
      }
      return;
    }

    // Add mode — send to all selected employees
    if (selectedEmployees.length === 0) {
      toast.error("Please select at least one employee");
      return;
    }
    setSaving(true);
    try {
      const attachmentPath = await uploadSelectedAttachment();
      const basePayload = {
        memoType: form.memoType || null,
        subject: form.subject || null,
        description: form.description || null,
        issuedDate: form.issuedDate || null,
        issuedBy: form.issuedBy || null,
        issuedByRole: user?.role ?? undefined,
        attachmentPath,
      };
      const results = await Promise.allSettled(
        selectedEmployees.map((emp) =>
          fetch(API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...basePayload, employeeID: emp.id }),
          })
        )
      );
      const failed = results.filter(
        (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok)
      ).length;
      if (failed === 0) {
        toast.success(
          `Memo sent to ${selectedEmployees.length} employee${selectedEmployees.length > 1 ? "s" : ""}`
        );
      } else {
        toast.warning(`Sent to ${selectedEmployees.length - failed} employees, ${failed} failed`);
      }
      resetForm();
      setIsAddingNew(false);
      fetchRows();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (row: MemoRow) => {
    setEditingRow(row);
    setSelectedEmployees([]);
    setEmpSearch("");
    setForm({
      employeeID: row.employeeID,
      empAutocomplete: `${row.manageEmployee?.employeeFirstName ?? ""} ${row.manageEmployee?.employeeLastName ?? ""} - ${row.manageEmployee?.employeeID ?? ""}`.trim(),
      memoType: row.memoType ?? "",
      subject: row.subject ?? "",
      description: row.description ?? "",
      issuedDate: row.issuedDate ? new Date(row.issuedDate).toISOString().split("T")[0] : "",
      issuedBy: row.issuedBy ?? "",
    });
    setIsAddingNew(true);
  };

  const handleCancel = () => {
    resetForm();
    setIsAddingNew(false);
    setIsViewing(false);
    setViewRow(null);
  };

  const openView = async (row: MemoRow) => {
    setViewRow(row);
    setIsViewing(true);
    setReplyText("");
    try {
      const res = await fetch(`${API}/${row.id}`);
      const data = await res.json();
      setViewReplies(Array.isArray(data?.replies) ? data.replies : []);
    } catch {
      setViewReplies([]);
    }
  };

  const handleUndo = async (id: number) => {
    try {
      const res = await fetch(`${API}/${id}/undo`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Message undone");
      fetchRows();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Undo failed");
    }
  };

  const handleReply = async () => {
    if (!viewRow || !replyText.trim()) return;
    setReplySaving(true);
    try {
      const res = await fetch(`${API}/${viewRow.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: replyText.trim(),
          issuedBy: user?.username || form.issuedBy,
          issuedByRole: user?.role || "MANAGER",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Reply sent");
      setReplyText("");
      await openView(viewRow);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Reply failed");
    } finally {
      setReplySaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this message?")) return;
    try {
      await fetch(`${API}/${id}`, { method: "DELETE" });
      toast.success("Deleted");
      fetchRows();
    } catch {
      toast.error("Delete failed");
    }
  };

  const filteredRows = useMemo(() => {
    const t = searchTerm.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => {
      const name = `${r.manageEmployee?.employeeFirstName ?? ""} ${r.manageEmployee?.employeeLastName ?? ""}`.toLowerCase();
      const eid = (r.manageEmployee?.employeeID ?? "").toLowerCase();
      const subj = (r.subject ?? "").toLowerCase();
      const type = (r.memoType ?? "").toLowerCase();
      return [name, eid, subj, type].some((x) => x.includes(t));
    });
  }, [rows, searchTerm]);

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto px-4">
      <div className="flex items-center justify-between w-full">
        <p className="text-gray-600 text-sm">Internal Messaging (IM) — official messages to colleagues</p>
        {!isAddingNew && !isViewing && canManage && (
          <Button onClick={() => { resetForm(); setIsAddingNew(true); }} className="text-sm px-3 py-2">
            <Plus className="w-4 h-4 mr-1" /> Create IM
          </Button>
        )}
      </div>

      {/* ── Add / Edit drawer ─────────────────────────────────────────────── */}
      <FormDrawer
        open={isAddingNew}
        onOpenChange={(v) => { if (!v) handleCancel(); }}
        title={editingRow ? "Edit IM" : "Create IM"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">

          {editingRow ? (
            /* Edit mode: single employee autocomplete */
            <div ref={empRef} className="space-y-2 relative">
              <Label>Employee *</Label>
              <Input
                value={form.empAutocomplete}
                onChange={(e) => {
                  setForm((p) => ({ ...p, empAutocomplete: e.target.value, employeeID: null }));
                  runFetchEmp(e.target.value);
                }}
                onFocus={(e) => { if (e.target.value.length >= 1) runFetchEmp(e.target.value); }}
                placeholder="Type employee name or ID…"
                autoComplete="off"
                required
              />
              {empList.length > 0 && (
                <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                  {empList.map((e) => (
                    <div
                      key={e.id}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={() => {
                        setForm((p) => ({
                          ...p,
                          employeeID: e.id,
                          empAutocomplete: `${e.employeeFirstName ?? ""} ${e.employeeLastName ?? ""} - ${e.employeeID ?? ""}`.trim(),
                        }));
                        setEmpList([]);
                      }}
                    >
                      {e.employeeFirstName ?? ""} {e.employeeLastName ?? ""} - {e.employeeID ?? ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Add mode: multi-select employees with chips */
            <div ref={empRef} className="space-y-2 relative">
              <Label>
                Employees *{" "}
                <span className="text-gray-400 font-normal text-xs">(select one or more)</span>
              </Label>

              {selectedEmployees.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 border rounded-md bg-gray-50 min-h-[36px]">
                  {selectedEmployees.map((emp) => (
                    <span
                      key={emp.id}
                      className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 text-xs font-medium px-2 py-1 rounded-full"
                    >
                      {emp.label}
                      <button
                        type="button"
                        onClick={() => setSelectedEmployees((prev) => prev.filter((x) => x.id !== emp.id))}
                        className="text-indigo-500 hover:text-indigo-800 leading-none"
                        aria-label="Remove"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <Input
                value={empSearch}
                onChange={(e) => { setEmpSearch(e.target.value); runFetchEmp(e.target.value); }}
                onFocus={(e) => { if (e.target.value.length >= 1) runFetchEmp(e.target.value); }}
                placeholder="Search and add employees…"
                autoComplete="off"
              />
              {empList.length > 0 && (
                <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                  {empList.map((e) => {
                    const alreadyAdded = selectedEmployees.some((s) => s.id === e.id);
                    return (
                      <div
                        key={e.id}
                        className={`px-3 py-2 cursor-pointer flex items-center justify-between ${
                          alreadyAdded ? "bg-gray-50 text-gray-400 cursor-default" : "hover:bg-gray-100"
                        }`}
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={() => {
                          if (alreadyAdded) return;
                          const label = `${e.employeeFirstName ?? ""} ${e.employeeLastName ?? ""} (${e.employeeID ?? ""})`.trim();
                          setSelectedEmployees((prev) => [...prev, { id: e.id, label }]);
                          setEmpSearch("");
                          setEmpList([]);
                        }}
                      >
                        <span>
                          {e.employeeFirstName ?? ""} {e.employeeLastName ?? ""} -{" "}
                          {e.employeeID ?? ""}
                        </span>
                        {alreadyAdded && (
                          <span className="text-xs text-green-600 font-medium">Added ✓</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>IM Type</Label>
              <Select
                value={form.memoType}
                onValueChange={(v) => setForm((p) => ({ ...p, memoType: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Information">Information</SelectItem>
                  <SelectItem value="Notice">Notice</SelectItem>
                  <SelectItem value="Warning">Warning</SelectItem>
                  <SelectItem value="Complaint">Complaint</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Issued Date</Label>
              <Input
                type="date"
                value={form.issuedDate}
                onChange={(e) => setForm((p) => ({ ...p, issuedDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Sub</Label>
            <Input
              value={form.subject}
              onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              placeholder="Subject"
            />
          </div>

          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={4}
              placeholder="Message body…"
            />
          </div>

          <div className="space-y-2">
            <Label>Attachment</Label>
            <Input
              type="file"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
            />
            {attachmentFile && (
              <p className="text-xs text-gray-500">
                Selected: {attachmentFile.name} ({Math.round(attachmentFile.size / 1024)} KB)
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Issued By</Label>
            <Input value={form.issuedBy} readOnly className="bg-gray-50" />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || uploadingAttachment}>
              {saving || uploadingAttachment
                ? "Saving…"
                : editingRow
                ? "Update"
                : `Send${selectedEmployees.length > 1 ? ` (${selectedEmployees.length})` : ""}`}
            </Button>
          </div>
        </form>
      </FormDrawer>

      {/* ── View details drawer ───────────────────────────────────────────── */}
      <FormDrawer
        open={!!(isViewing && viewRow)}
        onOpenChange={(v) => { if (!v) handleCancel(); }}
        title="Internal Message"
      >
        {viewRow && (
          <div className="space-y-4 text-sm">
            <div className="space-y-2">
              <p>
                <strong>To:</strong>{" "}
                {viewRow.manageEmployee?.employeeFirstName ?? ""}{" "}
                {viewRow.manageEmployee?.employeeLastName ?? ""}{" "}
                ({viewRow.manageEmployee?.employeeID ?? ""})
              </p>
              <p><strong>IM Type:</strong> {viewRow.memoType ?? "—"}</p>
              <p><strong>Sub:</strong> {viewRow.subject ?? "—"}</p>
              <p><strong>Message:</strong> {viewRow.description ?? "—"}</p>
              <p>
                <strong>Sent:</strong>{" "}
                {viewRow.createdAt ? new Date(viewRow.createdAt).toLocaleString() : "—"}
              </p>
              <p><strong>From:</strong> {viewRow.issuedBy ?? "—"}</p>
              {viewRow.attachmentPath && (
                <p>
                  <strong>Attachment:</strong>{" "}
                  <a
                    href={resolveAttachmentUrl(viewRow.attachmentPath)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#4f46e5] underline"
                  >
                    Open attachment
                  </a>
                </p>
              )}
            </div>

            {viewReplies.length > 0 && (
              <div className="border-t pt-3 space-y-2">
                <p className="font-semibold text-gray-800">Replies</p>
                {viewReplies.map((rep) => (
                  <div key={rep.id} className="rounded-lg bg-gray-50 p-3 text-xs">
                    <p className="font-medium">{rep.issuedBy || "—"}</p>
                    <p className="text-gray-600 mt-1">{rep.description}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-3 space-y-2">
              <Label>Reply</Label>
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={3}
                placeholder="Write a reply…"
              />
              <Button type="button" size="sm" onClick={() => void handleReply()} disabled={replySaving}>
                {replySaving ? "Sending…" : "Send reply"}
              </Button>
            </div>
          </div>
        )}
      </FormDrawer>

      {/* ── Table listing ─────────────────────────────────────────────────── */}
      {!isAddingNew && !isViewing && (
        <>
          <div className="flex items-center gap-2 bg-white rounded-lg border px-3 py-2 max-w-sm">
            <Search className="w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search memos…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-8 px-0 text-sm"
            />
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Issued Date</TableHead>
                    <TableHead>Issued By</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-400">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-400">
                        No memos found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium">
                            {r.manageEmployee?.employeeFirstName ?? ""}{" "}
                            {r.manageEmployee?.employeeLastName ?? ""}
                          </div>
                          <div className="text-xs text-gray-500">
                            {r.manageEmployee?.employeeID ?? ""}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={r.memoType === "Warning" ? "destructive" : "secondary"}>
                            {r.memoType || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell>{r.subject || "—"}</TableCell>
                        <TableCell>
                          {r.issuedDate ? new Date(r.issuedDate).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell>{r.issuedBy || "—"}</TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void openView(r)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {r.createdAt &&
                                Date.now() - new Date(r.createdAt).getTime() < 30 * 60 * 1000 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => void handleUndo(r.id)}
                                  title="Undo (30 min)"
                                >
                                  Undo
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(r)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(r.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
