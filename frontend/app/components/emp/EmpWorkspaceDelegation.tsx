"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, UserCog } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { authHeaders } from "@/lib/auth";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { FormModal } from "../ui/form-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { EmpMobileDateField } from "./EmpMobileDateField";
import { EmpTeamStyleDataSection, useTeamListControls } from "./desktop/EmpTeamStyleDataSection";
import { cn } from "@/app/utils/cn";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

type Colleague = {
  id: number;
  employeeID: string | null;
  name: string;
  employeePhotoUrl: string | null;
};

type DelegationRow = {
  id: number;
  delegatorId: number;
  delegateeId: number;
  delegationType: string;
  startDate: string | null;
  endDate: string | null;
  notification: string;
  description: string | null;
  status: string;
  delegatorName: string;
  delegateeName: string;
};

type DelegationListRow = DelegationRow & {
  role: "delegator" | "delegatee";
  counterpart: string;
};

function toListRows(asDelegator: DelegationRow[], asDelegatee: DelegationRow[]): DelegationListRow[] {
  return [
    ...asDelegator.map((row) => ({
      ...row,
      role: "delegator" as const,
      counterpart: row.delegateeName,
    })),
    ...asDelegatee.map((row) => ({
      ...row,
      role: "delegatee" as const,
      counterpart: row.delegatorName,
    })),
  ];
}

function delegationTypeLabel(type: string) {
  return type === "PERMANENT" ? "Permanent" : "Temporary";
}

function notificationLabel(value: string) {
  return value === "DELEGATEE_ONLY" ? "Delegatee" : "Delegator and Delegatee";
}

function dateRangeLabel(row: DelegationRow) {
  if (row.delegationType === "PERMANENT") return "Permanent";
  if (row.startDate && row.endDate) return `${row.startDate} → ${row.endDate}`;
  if (row.startDate) return `From ${row.startDate}`;
  return "—";
}

function DelegationTable({ rows }: { rows: DelegationListRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="px-4 py-3 font-medium text-muted-foreground">Role</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Counterpart</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Type</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Period</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Notification</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.role}-${row.id}`} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">
                  {row.role === "delegator" ? "Created by me" : "Assigned to me"}
                </td>
                <td className="px-4 py-3">{row.counterpart}</td>
                <td className="px-4 py-3">{delegationTypeLabel(row.delegationType)}</td>
                <td className="px-4 py-3">{dateRangeLabel(row)}</td>
                <td className="px-4 py-3">{notificationLabel(row.notification)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DelegationGrid({ rows }: { rows: DelegationListRow[] }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {rows.map((row) => (
        <DelegationCard key={`${row.role}-${row.id}`} row={row} role={row.role} />
      ))}
    </div>
  );
}

function DelegationCard({ row, role }: { row: DelegationRow; role: "delegator" | "delegatee" }) {
  const counterpart = role === "delegator" ? row.delegateeName : row.delegatorName;
  const roleLabel = role === "delegator" ? "Delegatee" : "Delegator";

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{roleLabel}</p>
          <p className="font-semibold text-foreground truncate">{counterpart}</p>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          {delegationTypeLabel(row.delegationType)}
        </span>
      </div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Period</dt>
          <dd className="font-medium text-foreground">{dateRangeLabel(row)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Notification</dt>
          <dd className="font-medium text-foreground">{notificationLabel(row.notification)}</dd>
        </div>
      </dl>
      {row.description ? (
        <p className="mt-3 text-sm text-muted-foreground border-t border-border pt-3">{row.description}</p>
      ) : null}
    </div>
  );
}

function SetupDelegationForm({
  delegatorName,
  colleagues,
  onSaved,
  onCancel,
}: {
  delegatorName: string;
  colleagues: Colleague[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [delegateeId, setDelegateeId] = useState("");
  const [delegationType, setDelegationType] = useState("TEMPORARY");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notification, setNotification] = useState("BOTH");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const save = async () => {
    if (!delegateeId) {
      toast.error("Please select a delegatee.");
      return;
    }
    if (delegationType === "TEMPORARY" && (!startDate || !endDate)) {
      toast.error("Please select a date range for temporary delegation.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${BACKEND}/emp-manager-scope/delegations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          delegateeId: Number(delegateeId),
          delegationType,
          startDate: delegationType === "TEMPORARY" ? startDate : undefined,
          endDate: delegationType === "TEMPORARY" ? endDate : undefined,
          notification,
          description: description.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to save delegation");
      }
      toast.success("Delegation saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save delegation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>
          Delegator <span className="text-destructive">*</span>
        </Label>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm font-medium">
          <UserCog className="size-4 text-primary shrink-0" />
          <span className="truncate">{delegatorName}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label>
          Delegatee <span className="text-destructive">*</span>
        </Label>
        <Select value={delegateeId} onValueChange={setDelegateeId}>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {colleagues.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={delegationType} onValueChange={setDelegationType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TEMPORARY">Temporary</SelectItem>
              <SelectItem value="PERMANENT">Permanent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {delegationType === "TEMPORARY" ? (
          <div className="space-y-2">
            <Label>Date range</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <EmpMobileDateField label="From" value={startDate} onChange={setStartDate} max={endDate || undefined} />
              <EmpMobileDateField label="To" value={endDate} onChange={setEndDate} min={startDate || undefined} />
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label>Notification</Label>
        <div className="flex flex-wrap gap-4">
          {[
            { value: "BOTH", label: "Delegator and Delegatee" },
            { value: "DELEGATEE_ONLY", label: "Delegatee" },
          ].map((opt) => (
            <label key={opt.value} className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="delegation-notification"
                value={opt.value}
                checked={notification === opt.value}
                onChange={() => setNotification(opt.value)}
                className="size-4 accent-primary"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Optional notes about this delegation"
        />
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="button" onClick={() => void save()} disabled={submitting}>
          Save
        </Button>
      </div>
    </div>
  );
}

function SetupDelegationInline({
  open,
  onOpenChange,
  delegatorName,
  colleagues,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delegatorName: string;
  colleagues: Colleague[];
  onSaved: () => void;
}) {
  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Setup Delegation"
      description="Assign a colleague to act on your behalf"
    >
      <SetupDelegationForm
        delegatorName={delegatorName}
        colleagues={colleagues}
        onSaved={() => {
          onSaved();
          onOpenChange(false);
        }}
        onCancel={() => onOpenChange(false)}
      />
    </FormModal>
  );
}

export function EmpWorkspaceDelegation({ embedded = false }: { embedded?: boolean } = {}) {
  const user = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [asDelegator, setAsDelegator] = useState<DelegationRow[]>([]);
  const [asDelegatee, setAsDelegatee] = useState<DelegationRow[]>([]);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [delegatorName, setDelegatorName] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const listControls = useTeamListControls("emp-profile-delegation-view");
  const { viewMode, selectViewMode, searchOpen, searchQuery, setSearchQuery, toggleSearch, filterOpen, toggleFilter } =
    listControls;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [delegRes, colRes] = await Promise.all([
        fetch(`${BACKEND}/emp-manager-scope/delegations`, { headers: authHeaders(), cache: "no-store" }),
        fetch(`${BACKEND}/emp-manager-scope/delegation-colleagues`, { headers: authHeaders(), cache: "no-store" }),
      ]);
      const delegData = delegRes.ok ? await delegRes.json() : { asDelegator: [], asDelegatee: [] };
      const colData = colRes.ok ? await colRes.json() : { colleagues: [] };
      setAsDelegator(Array.isArray(delegData.asDelegator) ? delegData.asDelegator : []);
      setAsDelegatee(Array.isArray(delegData.asDelegatee) ? delegData.asDelegatee : []);
      setColleagues(Array.isArray(colData.colleagues) ? colData.colleagues : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user?.username) return;
    fetch(`${BACKEND}/manage-emp/credentials/${encodeURIComponent(user.username)}`, {
      headers: authHeaders(),
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((creds) => {
        const emp = creds?.employee;
        const name = [emp?.employeeFirstName, emp?.employeeLastName].filter(Boolean).join(" ").trim();
        setDelegatorName(name || user.username || "You");
      })
      .catch(() => setDelegatorName(user.username || "You"));
  }, [user?.username]);

  const allRows = useMemo(() => toListRows(asDelegator, asDelegatee), [asDelegator, asDelegatee]);

  const filteredRows = useMemo(() => {
    return allRows.filter((row) => {
      if (roleFilter === "created" && row.role !== "delegator") return false;
      if (roleFilter === "assigned" && row.role !== "delegatee") return false;
      if (typeFilter !== "all" && row.delegationType !== typeFilter) return false;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        row.counterpart.toLowerCase().includes(q) ||
        delegationTypeLabel(row.delegationType).toLowerCase().includes(q) ||
        dateRangeLabel(row).toLowerCase().includes(q)
      );
    });
  }, [allRows, roleFilter, typeFilter, searchQuery]);

  return (
    <div className="space-y-6">
      <SetupDelegationInline
        open={formOpen}
        onOpenChange={setFormOpen}
        delegatorName={delegatorName}
        colleagues={colleagues}
        onSaved={() => void load()}
      />

      {!formOpen ? (
        <EmpTeamStyleDataSection
          title="My Delegation"
          subtitle={embedded ? undefined : "Delegate your responsibilities when you are away"}
          actions={
            <Button type="button" size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="size-4" />
              Setup delegation
            </Button>
          }
          searchOpen={searchOpen}
          onToggleSearch={toggleSearch}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search delegations…"
          filterOpen={filterOpen}
          onToggleFilter={toggleFilter}
          filterContent={
            <>
              {[
                { value: "all", label: "All roles" },
                { value: "created", label: "Created by me" },
                { value: "assigned", label: "Assigned to me" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRoleFilter(opt.value)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold border transition-colors",
                    roleFilter === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
              {[
                { value: "all", label: "All types" },
                { value: "TEMPORARY", label: "Temporary" },
                { value: "PERMANENT", label: "Permanent" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTypeFilter(opt.value)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold border transition-colors",
                    typeFilter === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </>
          }
          viewMode={viewMode}
          onViewModeChange={selectViewMode}
          loading={loading}
          empty={filteredRows.length === 0}
          emptyMessage="No active delegations"
          listContent={<DelegationTable rows={filteredRows} />}
          gridContent={<DelegationGrid rows={filteredRows} />}
        />
      ) : null}
    </div>
  );
}
