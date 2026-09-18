"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { hasModuleWriteAccess, isCompanyAdminLikeRole } from "@/lib/companyAccess";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { FormDrawer } from "../components/ui/form-drawer";
import { Plus, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { toast } from "sonner";
import { LocationFields } from "../components/ui/location-fields";
import { taskFetch } from "../utils/taskApi";
import { TaskContactsRepeater, sanitizeContacts, type TaskContactRow } from "../components/task/TaskContactsRepeater";
import { EnplSyncButton } from "../components/task/EnplSyncButton";
import { SearchSuggestInput } from "../components/SearchSuggestInput";
import { getSidebarContext } from "../utils/sidebarContext";
import { PageHeader } from "../components/app/page-header";
import { FilterBar, FilterSelect } from "../components/app/filter-bar";
import { EntityListShell } from "../components/app/entity-list-shell";
import type { DataTableColumn } from "../components/app/data-table";
import { EntityRowActions } from "../components/app/entity-row-actions";
import { DetailCard } from "../components/app/detail-card";
import { EntityDetailHero, EntityDetailLayout } from "../components/app/entity-detail-layout";
import { useClientTable, sortRows } from "../hooks/use-client-table";
import { useCompanyBranches } from "../hooks/useCompanyBranches";

interface Contact { id?: number; contactPerson: string; contactNumber: string; designation?: string | null; email?: string | null; }
interface Customer {
  id: number; customerCode: string; customerName: string;
  addressType?: string | null; gstNo?: string | null;
  relationshipManagerName?: string | null; relationshipManagerEmail?: string | null;
  address?: string | null; city?: string | null; state?: string | null;
  pincode?: string | null; country?: string | null; createdAt?: string;
  contacts?: Contact[]; _count?: { sites: number; tasks: number };
  branchesID?: number | null;
  branchName?: string | null;
  branches?: {
    id: number;
    branchName?: string | null;
    companyID?: number | null;
  } | null;
}

interface Branch {
  id: number;
  branchName: string;
  companyID?: number | null;
  serviceProviderID?: number | null;
}

const emptyForm = {
  customerCode: "",
  customerName: "",
  addressType: "Customer",
  gstNo: "",
  relationshipManagerName: "",
  relationshipManagerEmail: "",
  branchesID: undefined as number | undefined,
  branchName: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  country: "",
};

export default function CustomerManagement() {
  const user = useCurrentUser();
  const canManage = user?.role === "SUPERADMIN" || isCompanyAdminLikeRole(user?.role) || hasModuleWriteAccess("TASKS");
  const table = useClientTable("customerName");
  const [rows, setRows] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [viewRow, setViewRow] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [contacts, setContacts] = useState<TaskContactRow[]>([]);
  const [saving, setSaving] = useState(false);

  const [branchFilterList, setBranchFilterList] = useState<Branch[]>([]);
  const { isSingleBranch, autoBranchId, autoBranchName } = useCompanyBranches();

  const getActiveCompanyID = () => {
    const ctx = getSidebarContext();
    return ctx?.companyID ?? user?.companyID ?? null;
  };

  const loadBranchFilterList = useCallback(async () => {
    try {
      const res = await fetch("/backend/branches", { cache: "no-store" });
      const data = await res.json();

      const activeCompanyID = getActiveCompanyID();

      let branches: Branch[] = Array.isArray(data) ? data : data?.data ?? [];

      if (activeCompanyID) {
        branches = branches.filter(
          (b) => Number(b.companyID) === Number(activeCompanyID)
        );
      }

      setBranchFilterList(branches);
    } catch (e) {
      console.error("Failed to load branch filter list:", e);
      setBranchFilterList([]);
    }
  }, [user]);

  const load = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    try {
      const data = await taskFetch<{ items: Customer[]; total: number; totalPages: number }>(
        "/task-customers", user, undefined, { page, limit: 10, search: debouncedSearch });
      setRows(data.items); setTotal(data.total); setTotalPages(data.totalPages || 1);
    } catch (e: any) { toast.error(e.message || "Failed to load customers"); }
    finally { setLoading(false); }
  }, [canManage, user, page, debouncedSearch]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(table.search), 300);
    return () => clearTimeout(t);
  }, [table.search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const closeCustomerPagePanels = () => {
    setFormOpen(false);
    setViewOpen(false);

    setEditing(null);
    setViewRow(null);

    setForm(emptyForm);
    setContacts([]);
    setSaving(false);
  };

  useEffect(() => {
    load();
    loadBranchFilterList();
  }, [load, loadBranchFilterList]);

  useEffect(() => {
    const h = () => {
      load();
      loadBranchFilterList();
    };

    const sidebarPageClickHandler = (e: any) => {
      if (e.detail?.path === "/task-customers") {
        closeCustomerPagePanels();
        load();
        loadBranchFilterList();
      }
    };

    window.addEventListener("sidebar-context-changed", h);
    window.addEventListener("app-data-refresh", h);
    window.addEventListener("sidebar-main-page-click", sidebarPageClickHandler);

    return () => {
      window.removeEventListener("sidebar-context-changed", h);
      window.removeEventListener("app-data-refresh", h);
      window.removeEventListener("sidebar-main-page-click", sidebarPageClickHandler);
    };
  }, [load]);

  const fetchBranchSuggestions = async (query: string): Promise<Branch[]> => {
    const res = await fetch("/backend/branches", { cache: "no-store" });
    const data = await res.json();

    const activeCompanyID = getActiveCompanyID();
    const q = query.trim().toLowerCase();

    let branches: Branch[] = Array.isArray(data) ? data : data?.data ?? [];

    if (activeCompanyID) {
      branches = branches.filter(
        (b) => Number(b.companyID) === Number(activeCompanyID)
      );
    }

    if (q) {
      branches = branches.filter((b) =>
        String(b.branchName || "").toLowerCase().includes(q)
      );
    }

    return branches.slice(0, 20);
  };

  const filteredRows = useMemo(() => {
    const t = table.search.trim().toLowerCase();
    const list = rows.filter((r) => {
      const matchesBranch =
        branchFilter === "ALL" ||
        branchFilter === String(r.branchesID ?? r.branches?.id ?? "");
      if (!matchesBranch) return false;
      if (!t) return true;
      return [
        r.customerCode,
        r.customerName,
        r.branchName,
        r.branches?.branchName,
        r.city,
        r.state,
        r.pincode,
        r.address,
      ]
        .filter(Boolean)
        .map((x) => String(x).toLowerCase())
        .some((f) => f.includes(t));
    });
    return sortRows(list, table.sortBy, table.sortDir, (row, key) => {
      const r = row as Customer;
      if (key === "customerCode") return r.customerCode ?? "";
      if (key === "customerName") return r.customerName ?? "";
      if (key === "branchName") return r.branchName ?? r.branches?.branchName ?? "";
      if (key === "city") return r.city ?? "";
      if (key === "state") return r.state ?? "";
      if (key === "sites") return r._count?.sites ?? 0;
      return "";
    });
  }, [rows, branchFilter, table.search, table.sortBy, table.sortDir]);

  const branchFilterOptions = useMemo(
    () => [
      { value: "ALL", label: "All branches" },
      ...branchFilterList.map((b) => ({
        value: String(b.id),
        label: b.branchName || `Branch #${b.id}`,
      })),
    ],
    [branchFilterList],
  );

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      ...(isSingleBranch && autoBranchId
        ? { branchesID: autoBranchId, branchName: autoBranchName || "" }
        : {}),
    });
    setContacts([]);
    setFormOpen(true);
  };

  const openEdit = async (r: Customer) => {
    try {
      const full = await taskFetch<Customer>(`/task-customers/${r.id}`, user);
      setEditing(full);
      setForm({
        customerCode: full.customerCode || "",
        customerName: full.customerName || "",
        addressType: full.addressType || "Customer",
        gstNo: full.gstNo || "",
        relationshipManagerName: full.relationshipManagerName || "",
        relationshipManagerEmail: full.relationshipManagerEmail || "",
        branchesID: full.branchesID ?? full.branches?.id ?? undefined,
        branchName: full.branchName || full.branches?.branchName || "",
        address: full.address || "",
        city: full.city || "",
        state: full.state || "",
        pincode: full.pincode || "",
        country: full.country || "",
      });
      setContacts(full.contacts?.length
        ? full.contacts.map((c) => ({ contactPerson: c.contactPerson, contactNumber: c.contactNumber, designation: c.designation || "", email: c.email || "" }))
        : []);
      setFormOpen(true);
    } catch (e: any) { toast.error(e.message || "Failed to load customer"); }
  };

  const openView = async (r: Customer) => {
    try {
      const full = await taskFetch<Customer>(`/task-customers/${r.id}`, user);
      setViewRow(full); setViewOpen(true);
    } catch (e: any) { toast.error(e.message || "Failed to load customer"); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerName.trim()) { toast.error("Customer name is required"); return; }
    if (!form.address.trim()) { toast.error("Registered address is required"); return; }
    if (!form.branchesID) {
      toast.error("Branch is required");
      return;
    }
    if (!editing && !form.customerCode.trim()) { toast.error("Customer ID is required"); return; }
    setSaving(true);
    const payload = { ...form, customerCode: form.customerCode.trim() || undefined, contacts: sanitizeContacts(contacts) };
    try {
      if (editing) {
        await taskFetch(`/task-customers/${editing.id}`, user, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("Customer updated");
      } else {
        await taskFetch("/task-customers", user, { method: "POST", body: JSON.stringify(payload) });
        toast.success("Customer created");
      }
      setFormOpen(false); load();
    } catch (err: any) { toast.error(err.message || "Save failed"); }
    finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    try { await taskFetch(`/task-customers/${id}`, user, { method: "DELETE" }); toast.success("Customer deleted"); load(); }
    catch (err: any) { toast.error(err.message || "Delete failed"); }
  };

  const customerColumns = useMemo((): DataTableColumn<Customer>[] => [
    {
      key: "customerCode",
      header: "Customer ID",
      sortable: true,
      colSpan: 2,
      cell: (r) => <span className="font-mono text-sm">{r.customerCode}</span>,
    },
    {
      key: "customerName",
      header: "Name",
      sortable: true,
      colSpan: 3,
      cell: (r) => <span className="font-medium">{r.customerName}</span>,
    },
    {
      key: "branchName",
      header: "Branch Name",
      sortable: true,
      colSpan: 2,
      cell: (r) => r.branchName || r.branches?.branchName || "—",
    },
    {
      key: "city",
      header: "City",
      sortable: true,
      colSpan: 1,
      cell: (r) => r.city || "—",
    },
    {
      key: "state",
      header: "State",
      sortable: true,
      colSpan: 1,
      cell: (r) => r.state || "—",
    },
    {
      key: "sites",
      header: "Sites",
      sortable: true,
      colSpan: 1,
      cell: (r) => r._count?.sites ?? 0,
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

  if (!canManage) return <div className="p-6 text-gray-500">Access denied. Task customers are available to SuperAdmin and Company Admin only.</div>;

  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter">
      <PageHeader
        icon={ClipboardList}
        title="Customers"
        description="Manage task customers and contacts"
        actions={
          !formOpen && !viewOpen && canManage ? (
            <div className="flex items-center gap-2">
              <EnplSyncButton user={user} onDone={load} />
              <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> Add Customer</Button>
            </div>
          ) : null
        }
      />
      {!formOpen && !viewOpen && (
        <>
          <FilterBar
            search={{
              value: table.search,
              onChange: table.setSearch,
              placeholder: "Search by name or ID…",
            }}
            filters={
              <FilterSelect
                id="customers-branch"
                value={branchFilter}
                onChange={setBranchFilter}
                options={branchFilterOptions}
                width="w-56"
                ariaLabel="Filter by branch"
              />
            }
          />

          <EntityListShell
            title="All customers"
            totalLabel={() => `${total} customers`}
            columns={customerColumns}
            rows={filteredRows}
            rowKey={(r) => String(r.id)}
            isLoading={loading}
            sortBy={table.sortBy}
            sortDir={table.sortDir}
            onSort={table.setSort}
            emptyIcon={ClipboardList}
            emptyTitle="No customers found"
            emptyDescription="Add a customer to get started with task management."
            emptyAction={
              canManage ? (
                <Button onClick={openCreate}>
                  <Plus className="w-4 h-4 mr-1" /> Add Customer
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

      <FormDrawer open={formOpen} onOpenChange={(v) => { if (!v) setFormOpen(false); }} title={editing ? "Edit Customer" : "Add Customer"} showHeaderCancel>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Customer ID *</Label>
            <Input value={form.customerCode} onChange={(e) => setForm((p) => ({ ...p, customerCode: e.target.value }))}
              placeholder="Enter customer ID" required disabled={!!editing} />
          </div>

          {isSingleBranch ? (
            <div className="space-y-2">
              <Label>Branch</Label>
              <Input value={form.branchName || autoBranchName || ""} readOnly className="bg-muted" />
            </div>
          ) : (
            <SearchSuggestInput
              label="Branch *"
              placeholder="Search branch..."
              value={form.branchName}
              onChange={(value) =>
                setForm((p) => ({
                  ...p,
                  branchName: value,
                  branchesID: undefined,
                }))
              }
              onSelect={(selected: { display: string; value: number; item: Branch }) =>
                setForm((p) => ({
                  ...p,
                  branchName: selected.display,
                  branchesID: Number(selected.value),
                }))
              }
              fetchData={fetchBranchSuggestions}
              displayField="branchName"
              valueField="id"
              required
            />
          )}
          
          <div className="space-y-2">
            <Label>Customer Name *</Label>
            <Input value={form.customerName} onChange={(e) => setForm((p) => ({ ...p, customerName: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Address Type</Label>
              <Input value={form.addressType} onChange={(e) => setForm((p) => ({ ...p, addressType: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>GST No</Label>
              <Input value={form.gstNo} onChange={(e) => setForm((p) => ({ ...p, gstNo: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Relationship Manager</Label>
              <Input value={form.relationshipManagerName} onChange={(e) => setForm((p) => ({ ...p, relationshipManagerName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Manager Email</Label>
              <Input value={form.relationshipManagerEmail} onChange={(e) => setForm((p) => ({ ...p, relationshipManagerEmail: e.target.value }))} />
            </div>
          </div>

      

          <div className="space-y-2">
            <Label>Registered Address *</Label>
            <Textarea value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} rows={3} required />
          </div>
          <LocationFields values={form} onChange={(patch) => setForm((p) => ({ ...p, ...patch }))} showCurrency={false} pincodeLabel="PIN Code" />
          <TaskContactsRepeater contacts={contacts} onChange={setContacts} />
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={closeCustomerPagePanels}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Update" : "Create"}</Button>
          </div>



        </form>
      </FormDrawer>

      <FormDrawer
        open={viewOpen}
        onOpenChange={setViewOpen}
        title="Customer Details"
        showHeaderCancel
        cancelLabel="Close"
      >
        {viewRow && (
          <EntityDetailLayout
            hero={
              <EntityDetailHero
                title={viewRow.customerName}
                subtitle={<span>{viewRow.customerCode}</span>}
              />
            }
          >
            <DetailCard
              title="Overview"
              subtitle="Customer identification"
              rows={[
                { label: "Customer code", value: viewRow.customerCode },
                { label: "Customer name", value: viewRow.customerName },
              ]}
            />
            <DetailCard
              title="Location"
              subtitle="Address and regional details"
              rows={[
                { label: "Registered address", value: viewRow.address },
                { label: "City", value: viewRow.city },
                { label: "State", value: viewRow.state },
                { label: "PIN Code", value: viewRow.pincode },
                { label: "Country", value: viewRow.country },
              ]}
            />
            {viewRow.contacts && viewRow.contacts.length > 0 ? (
              <DetailCard title="Contacts" subtitle="Customer contact persons" className="lg:col-span-2">
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
