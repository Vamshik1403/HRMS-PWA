"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
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
  manageEmployee?: {
    id: number;
    companyID?: number;
    employeeFirstName?: string;
    employeeLastName?: string;
    employeeID?: string;
  };
}

export function EmployeeMemoManagement() {
  const user = useCurrentUser();
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN";

  const [rows, setRows] = useState<MemoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingRow, setEditingRow] = useState<MemoRow | null>(null);
  const [viewRow, setViewRow] = useState<MemoRow | null>(null);
  const [isViewing, setIsViewing] = useState(false);

  // Employee autocomplete
  const [empSearch, setEmpSearch] = useState("");
  const [empList, setEmpList] = useState<any[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const empRef = useRef<HTMLDivElement>(null);
  const empTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState({
    employeeID: null as number | null,
    empAutocomplete: "",
    memoType: "",
    subject: "",
    description: "",
    issuedDate: new Date().toISOString().split("T")[0],
    issuedBy: "",
  });

  const fetchRows = async () => {
    setLoading(true);
    try {
      const res = await fetch(API);
      const data = await res.json();
      let result = Array.isArray(data) ? data : data?.data ?? [];
      // Helper: get companyID from memo itself or from the linked employee
      const getCompanyID = (r: any) => r.companyID ?? r.manageEmployee?.companyID;
      if (user?.role === "SUPERADMIN") {
        const ctx = getSidebarContext();
        if (ctx?.companyID) {
          result = result.filter((r: any) => Number(getCompanyID(r)) === Number(ctx.companyID));
        }
      } else if (user?.role === "SERVICE_PROVIDER") {
        const ctx = getSidebarContext();
        const companyID = ctx?.companyID ?? user?.companyID;
        if (companyID) {
          result = result.filter((r: any) => Number(getCompanyID(r)) === Number(companyID));
        }
      } else if (user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN") {
        const ctx = getSidebarContext();
        const companyID = ctx?.companyID ?? user?.companyID;
        if (companyID) {
          result = result.filter((r: any) => Number(getCompanyID(r)) === Number(companyID));
        }
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
    const handler = () => { fetchRows(); };
    window.addEventListener("sidebar-context-changed", handler);
    return () => window.removeEventListener("sidebar-context-changed", handler);
  }, []);

  const runFetchEmp = (q: string) => {
    if (empTimerRef.current) clearTimeout(empTimerRef.current);
    empTimerRef.current = setTimeout(async () => {
      if (q.length < 1) { setEmpList([]); return; }
      setEmpLoading(true);
      try {
        const res = await fetch(EMP_API);
        const raw = await res.json();
        let all = Array.isArray(raw) ? raw : raw?.data ?? [];
        // Filter by company from sidebar context
        const ctx = getSidebarContext();
        const companyID = ctx?.companyID ?? user?.companyID;
        if (companyID) {
          all = all.filter((e: any) => e.companyID === companyID);
        }
        const ql = q.toLowerCase();
        const filtered = all.filter((e: any) => {
          const name = `${e.employeeFirstName ?? ""} ${e.employeeLastName ?? ""}`.toLowerCase();
          const eid = (e.employeeID ?? "").toLowerCase();
          return name.includes(ql) || eid.includes(ql);
        });
        setEmpList(filtered.slice(0, 20));
      } catch { setEmpList([]); }
      finally { setEmpLoading(false); }
    }, 250);
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (empRef.current && !empRef.current.contains(e.target as Node)) setEmpList([]);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

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
    setEditingRow(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employeeID) { toast.error("Please select an employee"); return; }
    setSaving(true);
    try {
      const payload = {
        employeeID: form.employeeID,
        memoType: form.memoType || null,
        subject: form.subject || null,
        description: form.description || null,
        issuedDate: form.issuedDate || null,
        issuedBy: form.issuedBy || null,
      };
      const url = editingRow ? `${API}/${editingRow.id}` : API;
      const method = editingRow ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      toast.success(editingRow ? "Memo updated" : "Memo created");
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

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this warning/notice?")) return;
    try {
      await fetch(`${API}/${id}`, { method: "DELETE" });
      toast.success("Deleted");
      fetchRows();
    } catch { toast.error("Delete failed"); }
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

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto px-4">
      <div className="flex items-center justify-between w-full">
        <p className="text-gray-600 text-sm">Manage employee warnings and notices</p>
        {!isAddingNew && !isViewing && canManage && (
          <Button onClick={() => { resetForm(); setIsAddingNew(true); }} className="text-sm px-3 py-2">
            <Plus className="w-4 h-4 mr-1" /> Add Warning / Notice
          </Button>
        )}
        {(isAddingNew || isViewing) && (
          <Button variant="outline" onClick={handleCancel} className="text-sm px-3 py-2">
            <X className="w-4 h-4 mr-1" /> Cancel
          </Button>
        )}
      </div>

      {/* Add/Edit FormDrawer */}
      <FormDrawer open={isAddingNew} onOpenChange={(v) => { if (!v) handleCancel(); }}
        title={editingRow ? "Edit Warning / Notice" : "Add Warning / Notice"}>
        <form onSubmit={handleSubmit} className="space-y-4">
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
                  <div key={e.id} className="px-3 py-2 hover:bg-gray-100 cursor-pointer" onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => {
                      setForm((p) => ({ ...p, employeeID: e.id, empAutocomplete: `${e.employeeFirstName ?? ""} ${e.employeeLastName ?? ""} - ${e.employeeID ?? ""}`.trim() }));
                      setEmpList([]);
                    }}>
                    {e.employeeFirstName ?? ""} {e.employeeLastName ?? ""} - {e.employeeID ?? ""}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.memoType} onValueChange={(v) => setForm((p) => ({ ...p, memoType: v }))}>
                <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Warning">Warning</SelectItem>
                  <SelectItem value="Notice">Notice</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Issued Date</Label>
              <Input type="date" value={form.issuedDate} onChange={(e) => setForm((p) => ({ ...p, issuedDate: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Subject</Label>
            <Input value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} placeholder="Subject of warning/notice" />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={4} placeholder="Details…" />
          </div>

          <div className="space-y-2">
            <Label>Issued By</Label>
            <Input value={form.issuedBy} readOnly className="bg-gray-50" />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleCancel}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : editingRow ? "Update" : "Create"}</Button>
          </div>
        </form>
      </FormDrawer>

      {/* View Details FormDrawer */}
      <FormDrawer open={!!(isViewing && viewRow)} onOpenChange={(v) => { if (!v) handleCancel(); }}
        title="Warning / Notice Details">
        {viewRow && (
          <div className="space-y-3 text-sm">
            <p><strong>Employee:</strong> {viewRow.manageEmployee?.employeeFirstName ?? ""} {viewRow.manageEmployee?.employeeLastName ?? ""} ({viewRow.manageEmployee?.employeeID ?? ""})</p>
            <p><strong>Type:</strong> {viewRow.memoType ?? "—"}</p>
            <p><strong>Subject:</strong> {viewRow.subject ?? "—"}</p>
            <p><strong>Description:</strong> {viewRow.description ?? "—"}</p>
            <p><strong>Issued Date:</strong> {viewRow.issuedDate ? new Date(viewRow.issuedDate).toLocaleDateString() : "—"}</p>
            <p><strong>Issued By:</strong> {viewRow.issuedBy ?? "—"}</p>
          </div>
        )}
      </FormDrawer>

      {/* Table listing - shown only when neither form nor view is open */}
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
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-400">Loading…</TableCell></TableRow>
                  ) : filteredRows.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-400">No memos found</TableCell></TableRow>
                  ) : (
                    filteredRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium">{r.manageEmployee?.employeeFirstName ?? ""} {r.manageEmployee?.employeeLastName ?? ""}</div>
                          <div className="text-xs text-gray-500">{r.manageEmployee?.employeeID ?? ""}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={r.memoType === "Warning" ? "destructive" : "secondary"}>{r.memoType || "—"}</Badge>
                        </TableCell>
                        <TableCell>{r.subject || "—"}</TableCell>
                        <TableCell>{r.issuedDate ? new Date(r.issuedDate).toLocaleDateString() : "—"}</TableCell>
                        <TableCell>{r.issuedBy || "—"}</TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => { setViewRow(r); setIsViewing(true); }}><Eye className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(r)}><Edit className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></Button>
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
