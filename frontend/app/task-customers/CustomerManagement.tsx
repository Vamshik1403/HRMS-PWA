"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { FormDrawer } from "../components/ui/form-drawer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Plus, Search, Edit, Trash2, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { toast } from "sonner";
import { LocationFields } from "../components/ui/location-fields";
import { taskFetch } from "../utils/taskApi";

interface Customer {
  id: number;
  customerCode: string;
  customerName: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
  createdAt?: string;
  _count?: { sites: number; tasks: number };
}

const emptyForm = {
  customerName: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  country: "",
};

export default function CustomerManagement() {
  const user = useCurrentUser();
  const canManage = user?.role === "SUPERADMIN" || user?.role === "COMPANY_ADMIN";
  const [rows, setRows] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [viewRow, setViewRow] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    try {
      const data = await taskFetch<{ items: Customer[]; total: number; totalPages: number }>(
        "/task-customers",
        user,
        undefined,
        { page, limit: 10, search },
      );
      setRows(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages || 1);
    } catch (e: any) {
      toast.error(e.message || "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, [canManage, user, page, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener("sidebar-context-changed", h);
    return () => window.removeEventListener("sidebar-context-changed", h);
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (r: Customer) => {
    setEditing(r);
    setForm({
      customerName: r.customerName || "",
      address: r.address || "",
      city: r.city || "",
      state: r.state || "",
      pincode: r.pincode || "",
      country: r.country || "",
    });
    setFormOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await taskFetch(`/task-customers/${editing.id}`, user, {
          method: "PATCH",
          body: JSON.stringify(form),
        });
        toast.success("Customer updated");
      } else {
        await taskFetch("/task-customers", user, {
          method: "POST",
          body: JSON.stringify(form),
        });
        toast.success("Customer created");
      }
      setFormOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this customer?")) return;
    try {
      await taskFetch(`/task-customers/${id}`, user, { method: "DELETE" });
      toast.success("Customer deleted");
      load();
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    }
  };

  if (!canManage) {
    return <div className="p-6 text-gray-500">Access denied. Task customers are available to SuperAdmin and Company Admin only.</div>;
  }

  return (
    <div className="space-y-6">
      {!formOpen && !viewOpen && (
        <div className="flex items-center justify-end">
          {canManage && (
            <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> Add Customer</Button>
          )}
        </div>
      )}

      {!formOpen && !viewOpen && (
        <>
          <Card>
            <CardContent className="p-4 flex gap-3 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input className="pl-10" placeholder="Search by name or ID…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
              </div>
              <Badge variant="secondary">{total} customers</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Sites</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">Loading…</TableCell></TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">No customers found</TableCell></TableRow>
                  ) : rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">{r.customerCode}</TableCell>
                      <TableCell className="font-medium">{r.customerName}</TableCell>
                      <TableCell>{r.city || "—"}</TableCell>
                      <TableCell>{r.state || "—"}</TableCell>
                      <TableCell>{r._count?.sites ?? 0}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => { setViewRow(r); setViewOpen(true); }}><Eye className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(r)}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        </>
      )}

      <FormDrawer open={formOpen} onOpenChange={(v) => { if (!v) setFormOpen(false); }} title={editing ? "Edit Customer" : "Add Customer"} showHeaderCancel>
        <form onSubmit={submit} className="space-y-4">
          {editing && (
            <div className="space-y-2">
              <Label>Customer ID</Label>
              <Input value={editing.customerCode} disabled />
            </div>
          )}
          <div className="space-y-2">
            <Label>Customer Name *</Label>
            <Input value={form.customerName} onChange={(e) => setForm((p) => ({ ...p, customerName: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Textarea value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} rows={3} />
          </div>
          <LocationFields values={form} onChange={(patch) => setForm((p) => ({ ...p, ...patch }))} showCurrency={false} />
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Update" : "Create"}</Button>
          </div>
        </form>
      </FormDrawer>

      <FormDrawer open={viewOpen} onOpenChange={setViewOpen} title="Customer Details">
        {viewRow && (
          <div className="space-y-3 text-sm">
            <div className="p-3 bg-gray-50 rounded-lg"><strong>ID:</strong> {viewRow.customerCode}</div>
            <div className="p-3 bg-gray-50 rounded-lg"><strong>Name:</strong> {viewRow.customerName}</div>
            <div className="p-3 bg-gray-50 rounded-lg"><strong>Address:</strong> {viewRow.address || "—"}</div>
            <div className="p-3 bg-gray-50 rounded-lg"><strong>City:</strong> {viewRow.city || "—"}</div>
            <div className="p-3 bg-gray-50 rounded-lg"><strong>State:</strong> {viewRow.state || "—"}</div>
            <div className="p-3 bg-gray-50 rounded-lg"><strong>Pin:</strong> {viewRow.pincode || "—"}</div>
            <div className="p-3 bg-gray-50 rounded-lg"><strong>Country:</strong> {viewRow.country || "—"}</div>
          </div>
        )}
      </FormDrawer>
    </div>
  );
}
