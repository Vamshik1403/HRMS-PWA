"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Plus, Edit, Trash2, Eye, EyeOff, X, Users } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useListAutoRefresh } from "../hooks/useListAutoRefresh";
import { toast } from "sonner";
import { FormDrawer } from "../components/ui/form-drawer";
import { DetailCard } from "../components/app/detail-card";
import { EntityDetailHero, EntityDetailLayout } from "../components/app/entity-detail-layout";
import { PageHeader } from "../components/app/page-header";
import { FilterBar } from "../components/app/filter-bar";
import { EntityListShell } from "../components/app/entity-list-shell";
import { useClientTable, sortRows } from "../hooks/use-client-table";
import type { DataTableColumn } from "../components/app/data-table";
import { listPrimaryButtonClass } from "../components/app/list-ui-styles";
import { cn } from "@/app/utils/cn";
import { isPasswordValid, PASSWORD_POLICY_MESSAGE } from "@/lib/passwordRules";
import { PasswordRuleHints } from "../components/ui/password-rule-hints";
import { ownerTitleForLegalEntity } from "@/lib/companyAccess";

const API = "/backend/users";

interface UserCompanyRow {
  id: number;
  userID: number;
  companyID: number;
  isPrimary: boolean;
  company?: {
    id: number;
    companyName?: string;
  } | null;
}

interface UserRow {
  id: number;
  username: string;
  role: string;
  firstName?: string | null;
  lastName?: string | null;
  contactNo?: string | null;
  email?: string | null;
  isActive: boolean;
  serviceProviderID?: number | null;
  companyID?: number | null;
  branchesID?: number | null;
  createdAt?: string;
  updatedAt?: string;
  serviceProvider?: { companyName?: string } | null;
  company?: { id?: number; companyName?: string; legalEntityType?: string } | null;
  branches?: { branchName?: string } | null;
  userCompanies?: UserCompanyRow[];
  /** True when row is a ManageEmployee company owner (not a User). */
  isOwnerEmployee?: boolean;
  ownerTitle?: string | null;
  manageEmployeeId?: number;
}

// Roles available based on the current user's role.
// COMPANY_OWNER logins are created only via the Tenants "Company Owners" icon.
const SUPERADMIN_ROLES = ["SUPERADMIN", "MULTI_COMPANY_ADMIN"];
const SERVICE_PROVIDER_ROLES = ["SERVICE_PROVIDER"];

const ADMIN_ROLES = ["BRANCH_ADMIN"];

const ROLE_DISPLAY: Record<string, string> = {
  SUPERADMIN: "SUPERADMIN",
  MULTI_COMPANY_ADMIN: "Multiple Company Access",
  SERVICE_PROVIDER: "SERVICE PROVIDER",
  COMPANY_OWNER: "COMPANY OWNER",
  COMPANY_ADMIN: "COMPANY ADMIN (legacy)",
  ADMIN: "ADMIN",
  BRANCH_ADMIN: "BRANCH ADMIN",
  EMPLOYEE: "EMPLOYEE",
};

const emptyUserForm = {
  firstName: "",
  lastName: "",
  contactNo: "",
  email: "",
  username: "",
  password: "",
  role: "SUPERADMIN",
  serviceProviderID: "" as string | number,
  companyID: "" as string | number,
  companyIDs: [] as number[],
  branchesID: "" as string | number,
  isActive: true,
};

export function SystemUsersManagement() {
  const user = useCurrentUser();
  const isSuperAdmin = user?.role === "SUPERADMIN";
  const isServiceProvider = user?.role === "SERVICE_PROVIDER";
  const isCompanyAdmin = user?.role === "COMPANY_ADMIN";
  const isAdmin = user?.role === "ADMIN";
const canAccess = isSuperAdmin || isServiceProvider || isAdmin;

  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const table = useClientTable("username");
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingRow, setEditingRow] = useState<UserRow | null>(null);
  const [isViewing, setIsViewing] = useState(false);
  const [viewRow, setViewRow] = useState<UserRow | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [spList, setSpList] = useState<any[]>([]);
  const [companyList, setCompanyList] = useState<any[]>([]);
  const [branchList, setBranchList] = useState<any[]>([]);

   const [form, setForm] = useState({ ...emptyUserForm });
  const [companySearch, setCompanySearch] = useState("");
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);

  const fetchRows = async () => {
    setLoading(true);
    try {
      // System Users is exclusively for SuperAdmin/platform-level logins.
      // Company-owner users created via the Tenants "Company Owners" icon
      // are intentionally excluded here — they are only visible on their
      // respective company record.
      const res = await fetch(API);
      const data = await res.json();
      const users: UserRow[] = Array.isArray(data) ? data : data?.data ?? [];
      setRows(users);
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

  useListAutoRefresh(() => {
    void fetchRows();
    void fetchDropdowns();
  }, []);

  const resetForm = () => {
    setForm({ ...emptyUserForm, role: isSuperAdmin ? "SUPERADMIN" : "" });
    setEditingRow(null);
    setIsViewing(false);
    setViewRow(null);
    setShowPassword(false);
    setCompanySearch("");
    setCompanyDropdownOpen(false);
  };

const filteredCompanies = useMemo(() => {
  if (form.role === "MULTI_COMPANY_ADMIN") return companyList;

  const spId =
    isServiceProvider && user?.serviceProviderID
      ? Number(user.serviceProviderID)
      : form.serviceProviderID
        ? Number(form.serviceProviderID)
        : null;

  if (!spId) return companyList;

  return companyList.filter(
    (c: any) => Number(c.serviceProviderID) === Number(spId)
  );
}, [companyList, form.role, form.serviceProviderID, isServiceProvider, user?.serviceProviderID]);

  const selectedCompanies = useMemo(() => {
    return companyList.filter((c: any) =>
      form.companyIDs.includes(Number(c.id))
    );
  }, [companyList, form.companyIDs]);

  const companySuggestions = useMemo(() => {
    const term = companySearch.trim().toLowerCase();

    return filteredCompanies
      .filter((c: any) => !form.companyIDs.includes(Number(c.id)))
      .filter((c: any) =>
        !term ? true : String(c.companyName || "").toLowerCase().includes(term)
      )
      .slice(0, 8);
  }, [filteredCompanies, companySearch, form.companyIDs]);

  const addCompanyToUser = (company: any) => {
    const id = Number(company.id);

    setForm((p) => {
      const ids = Array.from(new Set([...p.companyIDs, id]));

      return {
        ...p,
        companyIDs: ids,
        companyID: p.companyID || id,
        branchesID: "",
      };
    });

    setCompanySearch("");
    setCompanyDropdownOpen(false);
  };

  const removeCompanyFromUser = (companyId: number) => {
    setForm((p) => {
      const ids = p.companyIDs.filter((id) => id !== companyId);

      return {
        ...p,
        companyIDs: ids,
        companyID: Number(p.companyID) === companyId ? ids[0] || "" : p.companyID,
        branchesID: "",
      };
    });
  };

  const filteredBranches = useMemo(() => {
    if (!form.companyID) return branchList;
    return branchList.filter((b: any) => b.companyID === Number(form.companyID));
  }, [branchList, form.companyID]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username) { toast.error("Username is required"); return; }
    if (!editingRow && !form.password) { toast.error("Password is required"); return; }
    if (form.password && !isPasswordValid(form.password)) {
      toast.error(PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (!form.email.trim()) {
      toast.error("Email is required");
      return;
    }
    if (!form.contactNo.trim()) {
      toast.error("Contact number is required");
      return;
    }
    if (form.role === "MULTI_COMPANY_ADMIN" && form.companyIDs.length < 2) {
      toast.error("Select at least two companies for Multiple Company Access");
      return;
    }
    if ((form.role === "COMPANY_OWNER") && form.companyIDs.length === 0 && !form.companyID) {
        toast.error("Select a company for the Company Owner");
      return;
    }
    if (form.role === "COMPANY_OWNER" && !form.companyID && form.companyIDs.length === 0) {
      toast.error("Select a company for the Company Owner");
      return;
    }

    if ((form.role === "ADMIN" || form.role === "BRANCH_ADMIN") && !form.companyID) {
      toast.error("Company is required");
      return;
    }

    if (form.role === "BRANCH_ADMIN" && !form.branchesID) {
      toast.error("Branch is required");
      return;
    }

    setSaving(true);
    
    try {
      if (form.role === "COMPANY_OWNER") {
        if (editingRow) {
          toast.error("Edit company owners from the Company page");
          setSaving(false);
          return;
        }
        const companyId = Number(form.companyID || form.companyIDs[0]);
        const ownerRes = await fetch(`/backend/company/${companyId}/owner`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: form.firstName.trim() || form.username.trim(),
            lastName: form.lastName.trim() || undefined,
            username: form.username.trim(),
            password: form.password,
            personalPhoneNo: form.contactNo.trim() || undefined,
            businessEmail: form.email.trim() || undefined,
          }),
        });
        if (!ownerRes.ok) throw new Error(await ownerRes.text());
        toast.success("Company Owner created — they log in as an employee");
        resetForm();
        setTimeout(() => {
          setForm({ ...emptyUserForm, role: isSuperAdmin ? "SUPERADMIN" : "" });
        }, 0);
        setIsAddingNew(false);
        fetchRows();
        return;
      }

     const payload: any = {
        firstName: form.firstName.trim() || null,
        lastName: form.lastName.trim() || null,
        contactNo: form.contactNo.trim() || null,
        email: form.email.trim() || null,
        username: form.username.trim(),
        role: form.role || undefined,
serviceProviderID: isServiceProvider
  ? Number(user?.serviceProviderID)
  : form.serviceProviderID
    ? Number(form.serviceProviderID)
    : undefined,
    
    companyID:
      form.role === "SUPERADMIN"
        ? undefined
        : form.companyID
          ? Number(form.companyID)
          : form.companyIDs[0]
            ? Number(form.companyIDs[0])
            : undefined,
    companyIDs:
      form.role === "SUPERADMIN"
        ? undefined
        : form.companyIDs?.length
          ? form.companyIDs
          : undefined,
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
      setTimeout(() => {
  setForm({ ...emptyUserForm, role: isSuperAdmin ? "SUPERADMIN" : "" });
}, 0);
      setIsAddingNew(false);
      fetchRows();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

    const handleEdit = (row: UserRow) => {
    const mappedCompanyIDs =
      row.userCompanies?.length
        ? row.userCompanies.map((x) => Number(x.companyID))
        : row.companyID
          ? [Number(row.companyID)]
          : [];

    setEditingRow(row);
 setForm({
      firstName: row.firstName || "",
      lastName: row.lastName || "",
      contactNo: row.contactNo || "",
      email: row.email || "",
      username: row.username,
      password: "",
      role: row.role ?? "",
      serviceProviderID: row.serviceProviderID ?? "",
      companyID: row.companyID ?? mappedCompanyIDs[0] ?? "",
      companyIDs: mappedCompanyIDs,
      branchesID: row.branchesID ?? "",
      isActive: row.isActive,
    });

    setCompanySearch("");
    setCompanyDropdownOpen(false);
    setShowPassword(false);
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
    const row = rows.find((r) => r.id === id);
    if (!confirm(row?.isOwnerEmployee ? "Deactivate this Company Owner?" : "Delete this user?")) return;
    try {
      if (row?.isOwnerEmployee && row.companyID) {
        const res = await fetch(`/backend/company/${row.companyID}/owner/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(await res.text());
        toast.success("Company Owner deactivated");
      } else {
        await fetch(`${API}/${id}`, { method: "DELETE" });
        toast.success("Deleted");
      }
      fetchRows();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  };

  const handleMigrateAdmin = async (row: UserRow) => {
    if (!confirm(`Migrate ${row.username} from COMPANY_ADMIN to Company Owner employee login?`)) return;
    try {
      const res = await fetch(`/backend/company/migrate-admin/${row.id}`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      toast.success(
        data.temporaryPassword
          ? `Migrated. Temporary password: ${data.temporaryPassword}`
          : data.message || "Migrated",
      );
      fetchRows();
    } catch (e: any) {
      toast.error(e?.message || "Migrate failed");
    }
  };

  const filteredRows = useMemo(() => {
    let data = rows;
    // ADMIN can only see users in their own company, and cannot see COMPANY_ADMIN accounts
   if (isServiceProvider && user?.serviceProviderID) {
  data = data.filter(
    (r) =>
      Number(r.serviceProviderID) === Number(user.serviceProviderID) &&
      (r.role === "SERVICE_PROVIDER" || r.role === "COMPANY_ADMIN" || r.role === "COMPANY_OWNER")
  );
}

if (isAdmin && user?.companyID) {
  data = data.filter((r) => r.companyID === user.companyID && r.role !== "COMPANY_ADMIN");
}
    const t = table.search.trim().toLowerCase();
    if (t) {
      data = data.filter((r) => {
        return [
          r.username,
          r.firstName ?? "",
          r.lastName ?? "",
          r.email ?? "",
          r.role,
          r.serviceProvider?.companyName ?? "",
          r.company?.companyName ?? "",
          r.branches?.branchName ?? "",
          ...(r.userCompanies?.map((x) => x.company?.companyName ?? "") ?? []),
        ].some((x) => x.toLowerCase().includes(t));
      });
    }
    return sortRows(data, table.sortBy, table.sortDir, (row, key) => {
      switch (key) {
        case "name":
          return [row.firstName, row.lastName].filter(Boolean).join(" ") || row.username;
        case "username":
          return row.username || "";
        case "email":
          return row.email || "";
        case "role":
          return ROLE_DISPLAY[row.role] || row.role || "";
        case "company":
          return row.userCompanies?.length
            ? row.userCompanies.map((x) => x.company?.companyName).filter(Boolean).join(", ")
            : row.company?.companyName ?? "";
        case "branch":
          return row.branches?.branchName ?? "";
        case "status":
          return row.isActive ? "Active" : "Inactive";
        default:
          return "";
      }
    });
  }, [rows, table.search, table.sortBy, table.sortDir, isAdmin, isServiceProvider, user?.companyID, user?.serviceProviderID]);

  const userColumns: Array<DataTableColumn<UserRow>> = useMemo(
    () => [
      {
        key: "name",
        header: "Name",
        sortable: true,
        cell: (r) => (
          <span className="font-medium text-foreground">
            {[r.firstName, r.lastName].filter(Boolean).join(" ") || "—"}
          </span>
        ),
      },
      {
        key: "username",
        header: "Username",
        sortable: true,
        cell: (r) => r.username,
      },
      {
        key: "email",
        header: "Email",
        sortable: true,
        cell: (r) => r.email || "—",
      },
      {
        key: "role",
        header: "Role",
        sortable: true,
        cell: (r) => <Badge variant="secondary">{ROLE_DISPLAY[r.role] || r.role}</Badge>,
      },
      {
        key: "company",
        header: "Company",
        sortable: true,
        cell: (r) =>
          r.userCompanies?.length
            ? r.userCompanies.map((x) => x.company?.companyName).filter(Boolean).join(", ")
            : r.company?.companyName ?? "—",
      },
      {
        key: "branch",
        header: "Branch",
        sortable: true,
        cell: (r) => r.branches?.branchName ?? "—",
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        cell: (r) => (
          <Badge variant={r.isActive ? "default" : "destructive"}>
            {r.isActive ? "Active" : "Inactive"}
          </Badge>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        align: "right",
        cell: (r) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setViewRow(r);
                setIsViewing(true);
              }}
            >
              <Eye className="w-4 h-4" />
            </Button>
            {!r.isOwnerEmployee ? (
              <Button variant="ghost" size="sm" onClick={() => handleEdit(r)}>
                <Edit className="w-4 h-4" />
              </Button>
            ) : null}
            {r.role === "COMPANY_ADMIN" && isSuperAdmin ? (
              <Button
                variant="ghost"
                size="sm"
                title="Migrate to Company Owner"
                onClick={() => handleMigrateAdmin(r)}
                className="text-amber-700 hover:text-amber-900"
              >
                Migrate
              </Button>
            ) : null}
            {r.role !== "SUPERADMIN" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(r.id)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    // handleEdit/handleDelete are stable enough in this module scope for list actions
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (!canAccess) {
    return <div className="p-8 text-center text-gray-500">Access restricted.</div>;
  }

  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter">
      <PageHeader
        icon={Users}
        title="System Users"
        description="Manage system users and access"
        actions={
          !isAddingNew && !isViewing ? (
            <Button
              type="button"
              className={cn(listPrimaryButtonClass)}
              onClick={() => {
                resetForm();

                if (isServiceProvider && user?.serviceProviderID) {
                  setForm((p) => ({
                    ...p,
                    serviceProviderID: user.serviceProviderID as number,
                  }));
                }

                if (isAdmin && user?.companyID) {
                  setForm((p) => ({
                    ...p,
                    companyID: user.companyID as number,
                    companyIDs: [Number(user.companyID)],
                  }));
                }

                setIsAddingNew(true);
              }}
            >
              <Plus className="w-4 h-4" /> Add User
            </Button>
          ) : null
        }
      />

      {/* Add/Edit FormDrawer */}
      <FormDrawer open={isAddingNew} onOpenChange={(v) => { if (!v) handleCancel(); }}
        title={editingRow ? "Edit User" : "Add User"}>
        <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <div className="space-y-2">
    <Label>First Name</Label>
    <Input
      value={form.firstName}
      onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
      placeholder="First name"
    />
  </div>

  <div className="space-y-2">
    <Label>Last Name</Label>
    <Input
      value={form.lastName}
      onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
      placeholder="Last name"
    />
  </div>

  <div className="space-y-2">
    <Label>Contact No *</Label>
    <Input
      value={form.contactNo}
      onChange={(e) => setForm((p) => ({ ...p, contactNo: e.target.value }))}
      placeholder="Contact number"
      required
    />
  </div>

  <div className="space-y-2">
    <Label>Email *</Label>
    <Input
      type="email"
      value={form.email}
      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
      placeholder="Email address"
      required
    />
  </div>
</div>

<div className="space-y-2">
  <Label>Username *</Label>
            <Input
  autoComplete="new-username"
  name="new-user-username"
  value={form.username}
   onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} placeholder="Username" required />
          </div>

          <div className="space-y-2">
            <Label>{editingRow ? "New Password (leave blank to keep)" : "Password *"}</Label>
            <div className="relative">
              <Input
  autoComplete="new-password"
  name="new-user-password"
  type={showPassword ? "text" : "password"}
  value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder={editingRow ? "Leave blank to keep current" : "Enter a strong password"} className="pr-10" {...(!editingRow ? { required: true } : {})} />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <PasswordRuleHints password={form.password} />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select
              value={form.role}
              onValueChange={(v) =>
                setForm((p) => ({
                  ...p,
                  role: v,
                  serviceProviderID:
                    v === "SUPERADMIN" || v === "MULTI_COMPANY_ADMIN"
                      ? ""
                      : isServiceProvider
                        ? user?.serviceProviderID ?? ""
                        : p.serviceProviderID,
                  companyID: "",
                  companyIDs: [],
                  branchesID: "",
                }))
              }
            >
              <SelectTrigger><SelectValue placeholder="Select role…" /></SelectTrigger>
              <SelectContent>
                {(isSuperAdmin
                  ? SUPERADMIN_ROLES
                  : isServiceProvider
                    ? SERVICE_PROVIDER_ROLES
                    : isAdmin
                      ? ADMIN_ROLES
                      : []
                ).map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_DISPLAY[r] || r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* SP field: shown for SERVICE_PROVIDER, COMPANY_OWNER, ADMIN, BRANCH_ADMIN */}
          {isSuperAdmin && (form.role === "SERVICE_PROVIDER" || form.role === "COMPANY_OWNER" || form.role === "ADMIN" || form.role === "BRANCH_ADMIN") && (
            <div className="space-y-2">
              <Label>Service Provider</Label>
              <Select
                value={String(form.serviceProviderID)}
                onValueChange={(v) =>
                  setForm((p) => ({
                    ...p,
                    serviceProviderID: v,
                    companyID: "",
                    companyIDs: [],
                    branchesID: "",
                  }))
                }
              >
                <SelectTrigger><SelectValue placeholder="Select service provider…" /></SelectTrigger>
                <SelectContent>
                  {spList.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.companyName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {form.role === "MULTI_COMPANY_ADMIN" && (
            <div className="space-y-2">
              <Label>Companies *</Label>
              {selectedCompanies.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedCompanies.map((c: any) => (
                    <Badge key={c.id} variant="secondary" className="gap-1 pr-1">
                      {c.companyName}
                      <button
                        type="button"
                        className="rounded-sm p-0.5 hover:bg-muted"
                        onClick={() => removeCompanyFromUser(Number(c.id))}
                        aria-label={`Remove ${c.companyName}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="relative">
                <Input
                  value={companySearch}
                  onChange={(e) => {
                    setCompanySearch(e.target.value);
                    setCompanyDropdownOpen(true);
                  }}
                  onFocus={() => setCompanyDropdownOpen(true)}
                  placeholder="Search and add companies…"
                />
                {companyDropdownOpen && companySuggestions.length > 0 && (
                  <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover shadow-md">
                    {companySuggestions.map((c: any) => (
                      <button
                        key={c.id}
                        type="button"
                        className="flex w-full px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => addCompanyToUser(c)}
                      >
                        {c.companyName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Select at least two tenants. The first company is the primary login company.
              </p>
            </div>
          )}

                   {/* Company field */}
{(form.role === "COMPANY_OWNER" || form.role === "ADMIN" || form.role === "BRANCH_ADMIN") && (
            <div className="space-y-2">
              <Label>
Company
              </Label>

                <Select
                  value={String(form.companyID)}
                  onValueChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      companyID: v,
                      companyIDs: [Number(v)],
                      branchesID: "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select company…" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCompanies.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              {form.role === "COMPANY_OWNER" && form.companyID ? (
                <p className="text-xs text-muted-foreground">
                  Owner title:{" "}
                  <span className="font-medium text-foreground">
                    {ownerTitleForLegalEntity(
                      filteredCompanies.find((c: any) => Number(c.id) === Number(form.companyID))
                        ?.legalEntityType,
                    )}
                  </span>{" "}
                  (from company type)
                </p>
              ) : null}
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
            <Button type="button" variant="outline" size="lg" onClick={handleCancel}>Cancel</Button>
            <Button type="submit" size="lg" disabled={saving}>{saving ? "Saving…" : editingRow ? "Update" : "Create"}</Button>
          </div>
        </form>
      </FormDrawer>

      {/* View Details FormDrawer */}
      <FormDrawer open={!!(isViewing && viewRow)} onOpenChange={(v) => { if (!v) handleCancel(); }}
        title="User Details"
        showHeaderCancel
        cancelLabel="Close">
        {viewRow && (
          <EntityDetailLayout
            hero={
              <EntityDetailHero
                title={[viewRow.firstName, viewRow.lastName].filter(Boolean).join(" ") || viewRow.username}
                subtitle={<span>{ROLE_DISPLAY[viewRow.role] || viewRow.role}</span>}
                badge={viewRow.isActive ? "Active" : undefined}
              />
            }
          >
            <DetailCard
              title="Identity"
              subtitle="Personal account details"
              rows={[
                { label: "First name", value: viewRow.firstName },
                { label: "Last name", value: viewRow.lastName },
                { label: "Username", value: viewRow.username },
                { label: "Role", value: ROLE_DISPLAY[viewRow.role] || viewRow.role },
              ]}
            />
            <DetailCard
              title="Contact & access"
              subtitle="Contact details and organisation mapping"
              rows={[
                { label: "Contact no", value: viewRow.contactNo },
                { label: "Email", value: viewRow.email },
                { label: "Service provider", value: viewRow.serviceProvider?.companyName },
                {
                  label: "Company",
                  value: viewRow.userCompanies?.length
                    ? viewRow.userCompanies.map((x) => x.company?.companyName).filter(Boolean).join(", ")
                    : viewRow.company?.companyName,
                },
                { label: "Branch", value: viewRow.branches?.branchName },
                { label: "Status", value: viewRow.isActive ? "Active" : "Inactive" },
                {
                  label: "Created",
                  value: viewRow.createdAt ? new Date(viewRow.createdAt).toLocaleDateString() : undefined,
                },
              ]}
            />
          </EntityDetailLayout>
        )}
      </FormDrawer>

      {/* Table listing */}
      {!isAddingNew && !isViewing && (
        <>
          <FilterBar
            search={{
              value: table.search,
              onChange: table.setSearch,
              placeholder: "Search users…",
            }}
          />
          <EntityListShell
            title="System users"
            columns={userColumns}
            rows={filteredRows}
            rowKey={(r) => String(r.id)}
            isLoading={loading}
            sortBy={table.sortBy}
            sortDir={table.sortDir}
            onSort={table.setSort}
            emptyIcon={Users}
            emptyTitle="No users found"
            emptyDescription="Try a different search, or add a new system user."
          />
        </>
      )}
    </div>
  );
}
