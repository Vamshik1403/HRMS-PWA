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
import { SearchSuggestInput } from "../components/SearchSuggestInput";
import { TaskContactsRepeater, sanitizeContacts, type TaskContactRow } from "../components/task/TaskContactsRepeater";

interface CustomerOpt { id: number; customerCode: string; customerName: string; address?: string | null; city?: string | null; state?: string | null; pincode?: string | null; country?: string | null; }
interface Contact { id?: number; contactPerson: string; contactNumber: string; designation?: string | null; email?: string | null; }
interface Site {
  id: number; customerID: number; branchName: string;
  address?: string | null; city?: string | null; state?: string | null; pincode?: string | null; country?: string | null;
  latitude?: string | null; longitude?: string | null;
  customer?: CustomerOpt; contacts?: Contact[];
}

const emptyForm = { customerID: "", branchName: "", address: "", city: "", state: "", pincode: "", country: "", latitude: "", longitude: "" };

export default function SiteManagement() {
  const user = useCurrentUser();
  const canManage = user?.role === "SUPERADMIN" || user?.role === "COMPANY_ADMIN";
  const [rows, setRows] = useState<Site[]>([]);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<Site | null>(null);
  const [viewRow, setViewRow] = useState<Site | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [customerLabel, setCustomerLabel] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOpt | null>(null);
  const [sameAsCustomer, setSameAsCustomer] = useState(false);
  const [contacts, setContacts] = useState<TaskContactRow[]>([]);
  const [saving, setSaving] = useState(false);

  const searchCustomers = useCallback(async (q: string) => {
    const data = await taskFetch<CustomerOpt[]>("/task-customers/dropdown", user, undefined, { q, limit: 20 });
    return data.map((c) => ({ ...c, label: `${c.customerCode} — ${c.customerName}` }));
  }, [user]);

  const loadCustomers = useCallback(async () => {
    try { const data = await taskFetch<CustomerOpt[]>("/task-customers/dropdown", user, undefined, { limit: 100 }); setCustomers(data); }
    catch { /* ignore */ }
  }, [user]);

  const load = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    try {
      const extra: Record<string, string | number> = { page, limit: 10, search };
      if (filterCustomer) extra.customerID = filterCustomer;
      const data = await taskFetch<{ items: Site[]; total: number; totalPages: number }>("/task-customer-sites", user, undefined, extra);
      setRows(data.items); setTotal(data.total); setTotalPages(data.totalPages || 1);
    } catch (e: any) { toast.error(e.message || "Failed to load sites"); }
    finally { setLoading(false); }
  }, [canManage, user, page, search, filterCustomer]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);
  useEffect(() => { load(); }, [load]);

  const applyCustomerAddress = (c: CustomerOpt) => {
    setForm((p) => ({ ...p, address: c.address || "", city: c.city || "", state: c.state || "", pincode: c.pincode || "", country: c.country || "" }));
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm); setCustomerLabel(""); setSelectedCustomer(null); setSameAsCustomer(false); setContacts([]); setFormOpen(true); };

  const openEdit = async (r: Site) => {
    try {
      const full = await taskFetch<Site>(`/task-customer-sites/${r.id}`, user);
      setEditing(full);
      setForm({ customerID: String(full.customerID), branchName: full.branchName, address: full.address || "", city: full.city || "",
        state: full.state || "", pincode: full.pincode || "", country: full.country || "", latitude: full.latitude || "", longitude: full.longitude || "" });
      setSelectedCustomer(full.customer || null);
      setCustomerLabel(full.customer ? `${full.customer.customerCode} — ${full.customer.customerName}` : "");
      setSameAsCustomer(false);
      setContacts(full.contacts?.length
        ? full.contacts.map((c) => ({ contactPerson: c.contactPerson, contactNumber: c.contactNumber, designation: c.designation || "", email: c.email || "" }))
        : []);
      setFormOpen(true);
    } catch (e: any) { toast.error(e.message || "Failed to load site"); }
  };

  const openView = async (r: Site) => {
    try { const full = await taskFetch<Site>(`/task-customer-sites/${r.id}`, user); setViewRow(full); setViewOpen(true); }
    catch (e: any) { toast.error(e.message || "Failed to load site"); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.branchName.trim() || !form.customerID) { toast.error("Customer and branch name are required"); return; }
    setSaving(true);
    const payload = { ...form, customerID: Number(form.customerID), contacts: sanitizeContacts(contacts) };
    try {
      if (editing) {
        await taskFetch(`/task-customer-sites/${editing.id}`, user, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("Site updated");
      } else {
        await taskFetch("/task-customer-sites", user, { method: "POST", body: JSON.stringify(payload) });
        toast.success("Site created");
      }
      setFormOpen(false); load();
    } catch (err: any) { toast.error(err.message || "Save failed"); }
    finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this site?")) return;
    try { await taskFetch(`/task-customer-sites/${id}`, user, { method: "DELETE" }); toast.success("Site deleted"); load(); }
    catch (err: any) { toast.error(err.message || "Delete failed"); }
  };

  if (!canManage) return <div className="p-6 text-gray-500">Access denied.</div>;

  return (
    <div className="space-y-6">
      {!formOpen && !viewOpen && (
        <div className="flex items-center justify-end">
          {canManage && <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> Add Site</Button>}
        </div>
      )}
      {!formOpen && !viewOpen && (
        <>
          <Card>
            <CardContent className="p-4 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input className="pl-10" placeholder="Search sites…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
              </div>
              <select className="app-select w-auto min-w-[160px]" value={filterCustomer} onChange={(e) => { setFilterCustomer(e.target.value); setPage(1); }}>
                <option value="">All customers</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.customerName}</option>)}
              </select>
              <Badge variant="secondary">{total} sites</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead><TableHead>Branch</TableHead>
                    <TableHead>City</TableHead><TableHead>Lat / Long</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8">Loading…</TableCell></TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8">No sites found</TableCell></TableRow>
                  ) : rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.customer?.customerName || `#${r.customerID}`}</TableCell>
                      <TableCell className="font-medium">{r.branchName}</TableCell>
                      <TableCell>{r.city || "—"}</TableCell>
                      <TableCell className="text-xs">{r.latitude || "—"} / {r.longitude || "—"}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => openView(r)}><Eye className="w-4 h-4" /></Button>
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

      <FormDrawer open={formOpen} onOpenChange={(v) => { if (!v) setFormOpen(false); }} title={editing ? "Edit Site" : "Add Site"} showHeaderCancel>
        <form onSubmit={submit} className="space-y-4">
          <SearchSuggestInput
            label="Customer *"
            placeholder="Search customer by name or ID…"
            value={customerLabel}
            onChange={setCustomerLabel}
            fetchData={searchCustomers}
            displayField="label"
            valueField="id"
            required
            onSelect={({ value, item }) => {
              setForm((p) => ({ ...p, customerID: String(value) }));
              setSelectedCustomer(item);
              if (sameAsCustomer) applyCustomerAddress(item);
            }}
          />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={sameAsCustomer} disabled={!form.customerID}
              onChange={(e) => { setSameAsCustomer(e.target.checked); if (e.target.checked && selectedCustomer) applyCustomerAddress(selectedCustomer); }} />
            Same as selected customer address
          </label>
          <div className="space-y-2">
            <Label>Branch Name *</Label>
            <Input value={form.branchName} onChange={(e) => setForm((p) => ({ ...p, branchName: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Textarea value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} rows={2} disabled={sameAsCustomer} />
          </div>
          <LocationFields values={form} onChange={(patch) => setForm((p) => ({ ...p, ...patch }))} showCurrency={false} disabled={sameAsCustomer} />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Latitude</Label><Input value={form.latitude} onChange={(e) => setForm((p) => ({ ...p, latitude: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Longitude</Label><Input value={form.longitude} onChange={(e) => setForm((p) => ({ ...p, longitude: e.target.value }))} /></div>
          </div>
          <TaskContactsRepeater title="Site Contacts" contacts={contacts} onChange={setContacts} />
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </FormDrawer>

      <FormDrawer open={viewOpen} onOpenChange={setViewOpen} title="Site Details">
        {viewRow && (
          <div className="space-y-2 text-sm">
            <div className="p-3 bg-gray-50 rounded-lg"><strong>Customer:</strong> {viewRow.customer?.customerName}</div>
            <div className="p-3 bg-gray-50 rounded-lg"><strong>Branch:</strong> {viewRow.branchName}</div>
            <div className="p-3 bg-gray-50 rounded-lg"><strong>Address:</strong> {viewRow.address || "—"}</div>
            <div className="p-3 bg-gray-50 rounded-lg"><strong>Location:</strong> {[viewRow.city, viewRow.state, viewRow.pincode, viewRow.country].filter(Boolean).join(", ") || "—"}</div>
            <div className="p-3 bg-gray-50 rounded-lg"><strong>Coordinates:</strong> {viewRow.latitude || "—"} / {viewRow.longitude || "—"}</div>
            {viewRow.contacts && viewRow.contacts.length > 0 && (
              <div className="space-y-2">
                <p className="font-semibold">Site Contacts</p>
                {viewRow.contacts.map((c, i) => (
                  <div key={c.id ?? i} className="p-3 bg-gray-50 rounded-lg">
                    <div>{c.contactPerson} · {c.contactNumber}</div>
                    {(c.designation || c.email) && <div className="text-gray-500 text-xs mt-1">{[c.designation, c.email].filter(Boolean).join(" · ")}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </FormDrawer>
    </div>
  );
}
