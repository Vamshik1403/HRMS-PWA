"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { hasModuleWriteAccess } from "@/lib/companyAccess";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { FormDrawer } from "../components/ui/form-drawer";
import { Plus, ChevronLeft, ChevronRight, GitBranch } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { toast } from "sonner";
import { LocationFields } from "../components/ui/location-fields";
import { taskFetch } from "../utils/taskApi";
import { useListAutoRefresh } from "../hooks/useListAutoRefresh";
import { SearchSuggestInput } from "../components/SearchSuggestInput";
import { TaskContactsRepeater, sanitizeContacts, type TaskContactRow } from "../components/task/TaskContactsRepeater";
import { PageHeader } from "../components/app/page-header";
import { FilterBar, FilterSelect } from "../components/app/filter-bar";
import { EntityListShell } from "../components/app/entity-list-shell";
import type { DataTableColumn } from "../components/app/data-table";
import { EntityRowActions } from "../components/app/entity-row-actions";
import { DetailCard } from "../components/app/detail-card";
import { EntityDetailHero, EntityDetailLayout } from "../components/app/entity-detail-layout";
import { useClientTable, sortRows } from "../hooks/use-client-table";

interface CustomerOpt { id: number; customerCode: string; customerName: string; address?: string | null; city?: string | null; state?: string | null; pincode?: string | null; country?: string | null; }
interface Contact { id?: number; contactPerson: string; contactNumber: string; designation?: string | null; email?: string | null; }
interface Site {
  id: number; customerID: number; branchName: string;
  siteCode?: string | null; gstNo?: string | null;
  address?: string | null; city?: string | null; state?: string | null; pincode?: string | null; country?: string | null;
  latitude?: string | null; longitude?: string | null;
  customer?: CustomerOpt; contacts?: Contact[];
  notes?: { id?: number; title: string; description?: string | null; createdBy?: string | null }[];
}

const emptyForm = { customerID: "", siteCode: "", gstNo: "", branchName: "", address: "", city: "", state: "", pincode: "", country: "", latitude: "", longitude: "" };

export default function SiteManagement() {
  const user = useCurrentUser();
  const canManage = user?.role === "SUPERADMIN" || user?.role === "COMPANY_ADMIN" || hasModuleWriteAccess("TASKS");
  const table = useClientTable("branchName");
  const [rows, setRows] = useState<Site[]>([]);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");
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
  const [notes, setNotes] = useState<{ title: string; description: string; createdBy: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(table.search), 300);
    return () => clearTimeout(t);
  }, [table.search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterCustomer]);

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
      const extra: Record<string, string | number> = { page, limit: 10, search: debouncedSearch };
      if (filterCustomer) extra.customerID = filterCustomer;
      const data = await taskFetch<{ items: Site[]; total: number; totalPages: number }>("/task-customer-sites", user, undefined, extra);
      setRows(data.items); setTotal(data.total); setTotalPages(data.totalPages || 1);
    } catch (e: any) { toast.error(e.message || "Failed to load sites"); }
    finally { setLoading(false); }
  }, [canManage, user, page, debouncedSearch, filterCustomer]);

  const closeSitePagePanels = () => {
  setFormOpen(false);
  setViewOpen(false);

  setEditing(null);
  setViewRow(null);

  setForm(emptyForm);
  setCustomerLabel("");
  setSelectedCustomer(null);
  setSameAsCustomer(false);
  setContacts([]);
  setNotes([]);
  setSaving(false);
};

  useEffect(() => { loadCustomers(); }, [loadCustomers]);
  useListAutoRefresh(() => { void load(); }, [load]);

  useEffect(() => {
  const sidebarPageClickHandler = (e: any) => {
    if (e.detail?.path === "/task-customer-sites") {
      closeSitePagePanels();
      loadCustomers();
      load();
    }
  };

  window.addEventListener("sidebar-main-page-click", sidebarPageClickHandler);

  return () => {
    window.removeEventListener("sidebar-main-page-click", sidebarPageClickHandler);
  };
}, [load, loadCustomers]);

  const applyCustomerAddress = (c: CustomerOpt) => {
    setForm((p) => ({ ...p, address: c.address || "", city: c.city || "", state: c.state || "", pincode: c.pincode || "", country: c.country || "" }));
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm); setCustomerLabel(""); setSelectedCustomer(null); setSameAsCustomer(false); setContacts([]); setNotes([]); setFormOpen(true); };

  const openEdit = async (r: Site) => {
    try {
      const full = await taskFetch<Site>(`/task-customer-sites/${r.id}`, user);
      setEditing(full);
      setForm({ customerID: String(full.customerID), siteCode: full.siteCode || "", gstNo: full.gstNo || "", branchName: full.branchName, address: full.address || "", city: full.city || "",
        state: full.state || "", pincode: full.pincode || "", country: full.country || "", latitude: full.latitude || "", longitude: full.longitude || "" });
      setSelectedCustomer(full.customer || null);
      setCustomerLabel(full.customer ? `${full.customer.customerCode} — ${full.customer.customerName}` : "");
      setSameAsCustomer(false);
      setContacts(full.contacts?.length
        ? full.contacts.map((c) => ({ contactPerson: c.contactPerson, contactNumber: c.contactNumber, designation: c.designation || "", email: c.email || "" }))
        : []);
      setNotes(full.notes?.length
        ? full.notes.map((n) => ({ title: n.title || "", description: n.description || "", createdBy: n.createdBy || "" }))
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
    if (!form.branchName.trim() || !form.customerID) { toast.error("Customer and site name are required"); return; }
    if (!form.address.trim()) { toast.error("Site address is required"); return; }
    setSaving(true);
    const payload = { ...form, customerID: Number(form.customerID), contacts: sanitizeContacts(contacts), notes: notes.filter((n) => n.title.trim()) };
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
    try { await taskFetch(`/task-customer-sites/${id}`, user, { method: "DELETE" }); toast.success("Site deleted"); load(); }
    catch (err: any) { toast.error(err.message || "Delete failed"); }
  };

  const sortedRows = useMemo(
    () =>
      sortRows(rows, table.sortBy, table.sortDir, (row, key) => {
        const s = row as Site;
        if (key === "customer") return s.customer?.customerName ?? String(s.customerID);
        if (key === "branchName") return s.branchName ?? "";
        if (key === "city") return s.city ?? "";
        if (key === "coordinates") return `${s.latitude ?? ""}/${s.longitude ?? ""}`;
        return "";
      }),
    [rows, table.sortBy, table.sortDir],
  );

  const customerFilterOptions = useMemo(
    () => [
      { value: "ALL", label: "All customers" },
      ...customers.map((c) => ({
        value: String(c.id),
        label: c.customerName || `Customer #${c.id}`,
      })),
    ],
    [customers],
  );

  const siteColumns = useMemo((): DataTableColumn<Site>[] => [
    {
      key: "customer",
      header: "Customer",
      sortable: true,
      colSpan: 3,
      cell: (r) => r.customer?.customerName || `#${r.customerID}`,
    },
    {
      key: "branchName",
      header: "Branch",
      sortable: true,
      colSpan: 3,
      cell: (r) => <span className="font-medium">{r.branchName}</span>,
    },
    {
      key: "city",
      header: "City",
      sortable: true,
      colSpan: 2,
      cell: (r) => r.city || "—",
    },
    {
      key: "coordinates",
      header: "Lat / Long",
      sortable: true,
      colSpan: 2,
      cell: (r) => (
        <span className="text-xs">{r.latitude || "—"} / {r.longitude || "—"}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      colSpan: 2,
      align: "right",
      cell: (r) => (
        <EntityRowActions
          onView={() => openView(r)}
          onEdit={() => openEdit(r)}
          onDelete={() => remove(r.id)}
        />
      ),
    },
  ], []);

  if (!canManage) return <div className="p-6 text-gray-500">Access denied.</div>;

  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter">
      <PageHeader
        icon={GitBranch}
        title="Sites / Branches"
        description="Manage customer sites and branch locations"
        actions={
          !formOpen && !viewOpen && canManage ? (
            <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> Add Site</Button>
          ) : null
        }
      />
      {!formOpen && !viewOpen && (
        <>
          <FilterBar
            search={{
              value: table.search,
              onChange: table.setSearch,
              placeholder: "Search sites…",
            }}
            filters={
              <FilterSelect
                id="sites-customer"
                value={filterCustomer || "ALL"}
                onChange={(v) => setFilterCustomer(v === "ALL" ? "" : v)}
                options={customerFilterOptions}
                width="w-56"
                ariaLabel="Filter by customer"
              />
            }
          />

          <EntityListShell
            title="All sites"
            totalLabel={() => `${total} sites`}
            columns={siteColumns}
            rows={sortedRows}
            rowKey={(r) => String(r.id)}
            isLoading={loading}
            sortBy={table.sortBy}
            sortDir={table.sortDir}
            onSort={table.setSort}
            emptyIcon={GitBranch}
            emptyTitle="No sites found"
            emptyDescription="Add a site or branch location for a customer."
            emptyAction={
              canManage ? (
                <Button onClick={openCreate}>
                  <Plus className="w-4 h-4 mr-1" /> Add Site
                </Button>
              ) : undefined
            }
            footer={
              <div className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[13px] text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            }
          />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Site ID</Label>
              <Input value={form.siteCode} onChange={(e) => setForm((p) => ({ ...p, siteCode: e.target.value }))} placeholder="e.g. ENPL/2024/0001-SITE/01" />
            </div>
            <div className="space-y-2">
              <Label>GST No</Label>
              <Input value={form.gstNo} onChange={(e) => setForm((p) => ({ ...p, gstNo: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Site Name *</Label>
            <Input value={form.branchName} onChange={(e) => setForm((p) => ({ ...p, branchName: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label>Site Address *</Label>
            <Textarea value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} rows={2} disabled={sameAsCustomer} required />
          </div>
          <LocationFields values={form} onChange={(patch) => setForm((p) => ({ ...p, ...patch }))} showCurrency={false} disabled={sameAsCustomer} pincodeLabel="PIN Code" />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Latitude</Label><Input value={form.latitude} onChange={(e) => setForm((p) => ({ ...p, latitude: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Longitude</Label><Input value={form.longitude} onChange={(e) => setForm((p) => ({ ...p, longitude: e.target.value }))} /></div>
          </div>
          <TaskContactsRepeater title="Site Contacts" contacts={contacts} onChange={setContacts} />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Site Notes</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setNotes((p) => [...p, { title: "", description: "", createdBy: "" }])}>Add note</Button>
            </div>
            {notes.map((note, idx) => (
              <div key={idx} className="grid grid-cols-1 gap-2 rounded-md border p-3">
                <Input placeholder="Title" value={note.title} onChange={(e) => setNotes((p) => p.map((n, i) => i === idx ? { ...n, title: e.target.value } : n))} />
                <Textarea placeholder="Description" value={note.description} onChange={(e) => setNotes((p) => p.map((n, i) => i === idx ? { ...n, description: e.target.value } : n))} rows={2} />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
<Button type="button" variant="outline" onClick={closeSitePagePanels}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </FormDrawer>

      <FormDrawer
        open={viewOpen}
        onOpenChange={setViewOpen}
        title="Site Details"
        showHeaderCancel
        cancelLabel="Close"
      >
        {viewRow && (
          <EntityDetailLayout
            hero={
              <EntityDetailHero
                title={viewRow.branchName}
                subtitle={<span>{viewRow.customer?.customerName}</span>}
              />
            }
          >
            <DetailCard
              title="Overview"
              subtitle="Site organisation mapping"
              rows={[
                { label: "Customer", value: viewRow.customer?.customerName },
                { label: "Site name", value: viewRow.branchName },
              ]}
            />
            <DetailCard
              title="Location"
              subtitle="Address and geo details"
              rows={[
                { label: "Site address", value: viewRow.address },
                { label: "City", value: viewRow.city },
                { label: "State", value: viewRow.state },
                { label: "PIN Code", value: viewRow.pincode },
                { label: "Country", value: viewRow.country },
                { label: "Latitude", value: viewRow.latitude },
                { label: "Longitude", value: viewRow.longitude },
              ]}
            />
            {viewRow.contacts && viewRow.contacts.length > 0 ? (
              <DetailCard title="Contacts" subtitle="Site contact persons" className="lg:col-span-2">
                <div className="divide-y divide-border">
                  {viewRow.contacts.map((c, i) => (
                    <div key={c.id ?? i} className="py-3 text-sm">
                      <div className="font-medium">{c.contactPerson} · {c.contactNumber}</div>
                      {(c.designation || c.email) ? (
                        <div className="mt-1 text-muted-foreground">
                          {[c.designation, c.email].filter(Boolean).join(" · ")}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </DetailCard>
            ) : null}
          </EntityDetailLayout>
        )}
      </FormDrawer>
    </div>
  );
}
