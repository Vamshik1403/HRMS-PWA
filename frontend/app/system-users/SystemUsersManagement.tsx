"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Plus, Search, Edit, Trash2, Eye, EyeOff, X } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { toast } from "sonner";
import { FormDrawer } from "../components/ui/form-drawer";

const API = "/backend/users";

interface UserRow {
  id: number;
  username: string;
  role: string;
  isActive: boolean;
  serviceProviderID?: number | null;
  companyID?: number | null;
  branchesID?: number | null;
  createdAt?: string;
  updatedAt?: string;
  serviceProvider?: { companyName?: string } | null;
  company?: { companyName?: string } | null;
  branches?: { branchName?: string } | null;
}

// Roles available based on the current user's role
const SUPERADMIN_ROLES = ["SUPERADMIN", "SERVICE_PROVIDER", "COMPANY_ADMIN", "ADMIN", "BRANCH_ADMIN"];
const SERVICE_PROVIDER_ROLES = ["SERVICE_PROVIDER", "COMPANY_ADMIN", "ADMIN", "BRANCH_ADMIN"];
const ADMIN_ROLES = ["BRANCH_ADMIN"];

const ROLE_DISPLAY: Record<string, string> = {
  SUPERADMIN: "SUPERADMIN",
  SERVICE_PROVIDER: "SERVICE PROVIDER",
  COMPANY_ADMIN: "COMPANY ADMIN",
  ADMIN: "ADMIN",
  BRANCH_ADMIN: "BRANCH ADMIN",
  EMPLOYEE: "EMPLOYEE",
};

export function SystemUsersManagement() {
  const user = useCurrentUser();
  const isSuperAdmin = user?.role === "SUPERADMIN";
  const isServiceProvider = user?.role === "SERVICE_PROVIDER";
  const isCompanyAdmin = user?.role === "COMPANY_ADMIN";
  const isAdmin = user?.role === "ADMIN";
  const canAccess = isSuperAdmin || isAdmin;

  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingRow, setEditingRow] = useState<UserRow | null>(null);
  const [isViewing, setIsViewing] = useState(false);
  const [viewRow, setViewRow] = useState<UserRow | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [spList, setSpList] = useState<any[]>([]);
  const [companyList, setCompanyList] = useState<any[]>([]);
  const [branchList, setBranchList] = useState<any[]>([]);

  const [form, setForm] = useState({
    username: "",
    password: "",
    role: "",
    serviceProviderID: "" as string | number,
    companyID: "" as string | number,
    branchesID: "" as string | number,
    isActive: true,
  });

  const fetchRows = async () => {
    setLoading(true);
    try {
      const res = await fetch(API);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : data?.data ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdowns = async () => {
    try {
      const [spRes, compRes, brRes] = await Promise.all([
        fetch("/backend/service-provider"),
        fetch("/backend/company"),
        fetch("/backend/branches"),
      ]);
      const sp = await spRes.json();
      const comp = await compRes.json();
      const br = await brRes.json();
      setSpList(Array.isArray(sp) ? sp : sp?.data ?? []);
      setCompanyList(Array.isArray(comp) ? comp : comp?.data ?? []);
      setBranchList(Array.isArray(br) ? br : br?.data ?? []);
    } catch { /* silent */ }
  };

  useEffect(() => { fetchRows(); fetchDropdowns(); }, []);

  const resetForm = () => {
    setForm({ username: "", password: "", role: "", serviceProviderID: "", companyID: "", branchesID: "", isActive: true });
    setEditingRow(null);
  };

  const filteredCompanies = useMemo(() => {
    const spId = isServiceProvider && user?.serviceProviderID ? user.serviceProviderID : form.serviceProviderID ? Number(form.serviceProviderID) : null;
    if (!spId) return companyList;
    return companyList.filter((c: any) => c.serviceProviderID === Number(spId));
  }, [companyList, form.serviceProviderID, isServiceProvider, user?.serviceProviderID]);

  const filteredBranches = useMemo(() => {
    if (!form.companyID) return branchList;
    return branchList.filter((b: any) => b.companyID === Number(form.companyID));
  }, [branchList, form.companyID]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username) { toast.error("Username is required"); return; }
    if (!editingRow && !form.password) { toast.error("Password is required"); return; }
    setSaving(true);
    try {
      const payload: any = {
        username: form.username,
        role: form.role || undefined,
        serviceProviderID: form.serviceProviderID ? Number(form.serviceProviderID) : undefined,
        companyID: form.companyID ? Number(form.companyID) : undefined,
        branchesID: form.branchesID ? Number(form.branchesID) : undefined,
        isActive: form.isActive,
      };
      if (form.password) payload.password = form.password;

      const url = editingRow ? `${API}/${editingRow.id}` : API;
      const method = editingRow ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      toast.success(editingRow ? "User updated" : "User created");
      resetForm();
      setIsAddingNew(false);
      fetchRows();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (row: UserRow) => {
    setEditingRow(row);
    setForm({
      username: row.username,
      password: "",
      role: row.role ?? "",
      serviceProviderID: row.serviceProviderID ?? "",
      companyID: row.companyID ?? "",
      branchesID: row.branchesID ?? "",
      isActive: row.isActive,
    });
    setIsAddingNew(true);
  };

  const handleCancel = () => {
    resetForm();
    setIsAddingNew(false);
    setIsViewing(false);
    setViewRow(null);
    setShowPassword(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this user?")) return;
    try {
      await fetch(`${API}/${id}`, { method: "DELETE" });
      toast.success("Deleted");
      fetchRows();
    } catch { toast.error("Delete failed"); }
  };

  const filteredRows = useMemo(() => {
    let data = rows;
    // ADMIN can only see users in their own company, and cannot see COMPANY_ADMIN accounts
    if (isAdmin && user?.companyID) {
      data = data.filter((r) => r.companyID === user.companyID && r.role !== "COMPANY_ADMIN");
    }
    const t = searchTerm.trim().toLowerCase();
    if (!t) return data;
    return data.filter((r) => {
      return [
        r.username,
        r.role,
        r.serviceProvider?.companyName ?? "",
        r.company?.companyName ?? "",
        r.branches?.branchName ?? "",
      ].some((x) => x.toLowerCase().includes(t));
    });
  }, [rows, searchTerm, isAdmin, user?.companyID]);

  if (!canAccess) {
    return <div className="p-8 text-center text-gray-500">Access restricted.</div>;
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto px-4">
      <div className="flex items-center justify-between w-full">
        <p className="text-gray-600 text-sm">Manage system users and access</p>
        {!isAddingNew && !isViewing && (
          <Button onClick={() => { resetForm(); if (isAdmin && user?.companyID) { setForm(p => ({ ...p, companyID: user.companyID as number })); } setIsAddingNew(true); }} className="text-sm px-3 py-2">
            <Plus className="w-4 h-4 mr-1" /> Add User
          </Button>
        )}
      </div>

      {/* Add/Edit FormDrawer */}
      <FormDrawer open={isAddingNew} onOpenChange={(v) => { if (!v) handleCancel(); }}
        title={editingRow ? "Edit User" : "Add User"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Username *</Label>
            <Input value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} placeholder="Username" required />
          </div>

          <div className="space-y-2">
            <Label>{editingRow ? "New Password (leave blank to keep)" : "Password *"}</Label>
            <div className="relative">
              <Input type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder={editingRow ? "Leave blank to keep current" : "Minimum 6 characters"} className="pr-10" {...(!editingRow ? { required: true, minLength: 6 } : {})} />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm((p) => ({ ...p, role: v, companyID: "", branchesID: "" }))}>
              <SelectTrigger><SelectValue placeholder="Select role…" /></SelectTrigger>
              <SelectContent>
                {(isSuperAdmin ? SUPERADMIN_ROLES : isAdmin ? ADMIN_ROLES : SERVICE_PROVIDER_ROLES).map((r) => <SelectItem key={r} value={r}>{r === "SERVICE_PROVIDER" ? "SERVICE PROVIDER" : r === "BRANCH_ADMIN" ? "BRANCH ADMIN" : r === "COMPANY_ADMIN" ? "COMPANY ADMIN" : r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* SP field: shown for SERVICE_PROVIDER, COMPANY_ADMIN, ADMIN, BRANCH_ADMIN */}
          {isSuperAdmin && (form.role === "SERVICE_PROVIDER" || form.role === "COMPANY_ADMIN" || form.role === "ADMIN" || form.role === "BRANCH_ADMIN") && (
            <div className="space-y-2">
              <Label>Service Provider</Label>
              <Select value={String(form.serviceProviderID)} onValueChange={(v) => setForm((p) => ({ ...p, serviceProviderID: v, companyID: "", branchesID: "" }))}>
                <SelectTrigger><SelectValue placeholder="Select service provider…" /></SelectTrigger>
                <SelectContent>
                  {spList.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.companyName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Company field: shown for COMPANY_ADMIN, ADMIN, BRANCH_ADMIN */}
          {(form.role === "COMPANY_ADMIN" || form.role === "ADMIN" || form.role === "BRANCH_ADMIN") && (
            <div className="space-y-2">
              <Label>Company</Label>
              <Select value={String(form.companyID)} onValueChange={(v) => setForm((p) => ({ ...p, companyID: v, branchesID: "" }))}>
                <SelectTrigger><SelectValue placeholder="Select company…" /></SelectTrigger>
                <SelectContent>
                  {filteredCompanies.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.companyName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Branch field: shown only for BRANCH_ADMIN */}
          {form.role === "BRANCH_ADMIN" && (
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select value={String(form.branchesID)} onValueChange={(v) => setForm((p) => ({ ...p, branchesID: v }))}>
                <SelectTrigger><SelectValue placeholder="Select branch…" /></SelectTrigger>
                <SelectContent>
                  {filteredBranches.map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.branchName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {editingRow && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
              <Label htmlFor="isActive">Active</Label>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleCancel}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : editingRow ? "Update" : "Create"}</Button>
          </div>
        </form>
      </FormDrawer>

      {/* View Details FormDrawer */}
      <FormDrawer open={!!(isViewing && viewRow)} onOpenChange={(v) => { if (!v) handleCancel(); }}
        title="User Details">
        {viewRow && (
          <div className="space-y-3 text-sm">
            <p><strong>Username:</strong> {viewRow.username}</p>
            <p><strong>Role:</strong> {ROLE_DISPLAY[viewRow.role] || viewRow.role}</p>
            <p><strong>Service Provider:</strong> {viewRow.serviceProvider?.companyName ?? "—"}</p>
            <p><strong>Company:</strong> {viewRow.company?.companyName ?? "—"}</p>
            <p><strong>Branch:</strong> {viewRow.branches?.branchName ?? "—"}</p>
            <p><strong>Status:</strong> {viewRow.isActive ? "Active" : "Inactive"}</p>
            <p><strong>Created:</strong> {viewRow.createdAt ? new Date(viewRow.createdAt).toLocaleDateString() : "—"}</p>
          </div>
        )}
      </FormDrawer>

      {/* Table listing */}
      {!isAddingNew && !isViewing && (
        <>
          <div className="flex items-center gap-2 bg-white rounded-lg border px-3 py-2 max-w-sm">
            <Search className="w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search users…"
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
                    <TableHead>Username</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-400">Loading…</TableCell></TableRow>
                  ) : filteredRows.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-400">No users found</TableCell></TableRow>
                  ) : (
                    filteredRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.username}</TableCell>
                        <TableCell><Badge variant="secondary">{ROLE_DISPLAY[r.role] || r.role}</Badge></TableCell>
                        <TableCell>{r.company?.companyName ?? "—"}</TableCell>
                        <TableCell>{r.branches?.branchName ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={r.isActive ? "default" : "destructive"}>{r.isActive ? "Active" : "Inactive"}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => { setViewRow(r); setIsViewing(true); }}><Eye className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(r)}><Edit className="w-4 h-4" /></Button>
                            {r.role !== "SUPERADMIN" && (
                              <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></Button>
                            )}
                          </div>
                        </TableCell>
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
