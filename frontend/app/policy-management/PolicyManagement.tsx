"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { FormDrawer } from "../components/ui/form-drawer";
import { PageHeader } from "../components/app/page-header";
import { FilterBar } from "../components/app/filter-bar";
import { EntityListShell } from "../components/app/entity-list-shell";
import { useClientTable, sortRows } from "../hooks/use-client-table";
import { useListAutoRefresh } from "../hooks/useListAutoRefresh";
import { useCurrentUser } from "../hooks/useCurrentUser";
import type { DataTableColumn } from "../components/app/data-table";
import { listPrimaryButtonClass } from "../components/app/list-ui-styles";
import { cn } from "@/app/utils/cn";
import { Badge } from "../components/ui/badge";

const API = "/backend/company-policies";

type PolicyType = "TERMS_OF_USE" | "PRIVACY_POLICY" | "SLA";

interface PolicyRow {
  id: number;
  type: PolicyType;
  policyName: string;
  versionName: string;
  effectiveFrom: string;
  bodyHtml: string;
  createdAt: string;
}

const TYPE_LABEL: Record<PolicyType, string> = {
  TERMS_OF_USE: "Terms of Use",
  PRIVACY_POLICY: "Privacy Policy",
  SLA: "SLA",
};

const emptyForm = {
  type: "" as PolicyType | "",
  policyName: "",
  versionName: "",
  effectiveFrom: "",
  bodyHtml: "",
};

function PolicyRichTextEditor({
  resetKey,
  value,
  onChange,
}: {
  resetKey: number;
  value: string;
  onChange: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value || "";
  }, [resetKey]);

  const exec = (command: string) => {
    document.execCommand(command, false);
    onChange(ref.current?.innerHTML || "");
    ref.current?.focus();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        <Button type="button" variant="outline" size="sm" onClick={() => exec("bold")}>
          B
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => exec("italic")}>
          I
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => exec("underline")}>
          U
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => exec("insertUnorderedList")}>
          List
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => exec("insertOrderedList")}>
          1.
        </Button>
      </div>
      <div
        ref={ref}
        contentEditable
        className="min-h-[280px] rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        onInput={() => onChange(ref.current?.innerHTML || "")}
      />
    </div>
  );
}

export function PolicyManagement() {
  const user = useCurrentUser();
  const isSuperAdmin = user?.role === "SUPERADMIN";
  const table = useClientTable("effectiveFrom");
  const [rows, setRows] = useState<PolicyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editorKey, setEditorKey] = useState(0);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("accessToken") || localStorage.getItem("token");
      const res = await fetch(API, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useListAutoRefresh(() => {
    void fetchRows();
  }, []);

  const latestIds = useMemo(() => {
    const map = new Map<PolicyType, PolicyRow>();
    const now = Date.now();
    const sorted = [...rows].sort((a, b) => {
      const ad = new Date(a.effectiveFrom).getTime();
      const bd = new Date(b.effectiveFrom).getTime();
      if (ad !== bd) return bd - ad;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    for (const row of sorted) {
      if (new Date(row.effectiveFrom).getTime() > now) continue;
      if (!map.has(row.type)) map.set(row.type, row);
    }
    for (const row of sorted) {
      if (!map.has(row.type)) map.set(row.type, row);
    }
    return new Set(Array.from(map.values()).map((r) => r.id));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const t = table.search.trim().toLowerCase();
    let data = rows;
    if (t) {
      data = data.filter((r) =>
        [TYPE_LABEL[r.type], r.policyName, r.versionName].some((x) =>
          String(x || "").toLowerCase().includes(t),
        ),
      );
    }
    return sortRows(data, table.sortBy, table.sortDir, (row, key) => {
      switch (key) {
        case "type":
          return TYPE_LABEL[row.type];
        case "policyName":
          return row.policyName;
        case "versionName":
          return row.versionName;
        case "effectiveFrom":
          return row.effectiveFrom;
        default:
          return "";
      }
    });
  }, [rows, table.search, table.sortBy, table.sortDir]);

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditorKey((k) => k + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.type) {
      toast.error("Select a policy type");
      return;
    }
    if (!form.policyName.trim() || !form.versionName.trim() || !form.effectiveFrom) {
      toast.error("Policy name, version and effective date are required");
      return;
    }
    setSaving(true);
    try {
      const token = localStorage.getItem("accessToken") || localStorage.getItem("token");
      const res = await fetch(API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          type: form.type,
          policyName: form.policyName.trim(),
          versionName: form.versionName.trim(),
          effectiveFrom: form.effectiveFrom,
          bodyHtml: form.bodyHtml,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Policy version added");
      resetForm();
      setIsAddingNew(false);
      fetchRows();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save policy");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this policy version?")) return;
    try {
      const token = localStorage.getItem("accessToken") || localStorage.getItem("token");
      const res = await fetch(`${API}/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Deleted");
      fetchRows();
    } catch (err: any) {
      toast.error(err?.message || "Delete failed");
    }
  };

  const columns: Array<DataTableColumn<PolicyRow>> = useMemo(
    () => [
      {
        key: "type",
        header: "Type",
        sortable: true,
        cell: (r) => TYPE_LABEL[r.type],
      },
      {
        key: "policyName",
        header: "Policy name",
        sortable: true,
        cell: (r) => r.policyName,
      },
      {
        key: "versionName",
        header: "Version",
        sortable: true,
        cell: (r) => r.versionName,
      },
      {
        key: "effectiveFrom",
        header: "Effective from",
        sortable: true,
        cell: (r) => new Date(r.effectiveFrom).toLocaleDateString(),
      },
      {
        key: "status",
        header: "Status",
        cell: (r) =>
          latestIds.has(r.id) ? (
            <Badge>Latest</Badge>
          ) : (
            <Badge variant="secondary">History</Badge>
          ),
      },
      {
        key: "actions",
        header: "Actions",
        align: "right",
        cell: (r) => (
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-700"
            onClick={() => handleDelete(r.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        ),
      },
    ],
    [latestIds],
  );

  if (!isSuperAdmin) {
    return <div className="p-8 text-center text-gray-500">Access restricted.</div>;
  }

  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter">
      <PageHeader
        icon={FileText}
        title="Policy Management"
        description="Terms of Use, Privacy Policy and SLA versions"
        actions={
          !isAddingNew ? (
            <Button
              type="button"
              className={cn(listPrimaryButtonClass)}
              onClick={() => {
                resetForm();
                setIsAddingNew(true);
              }}
            >
              <Plus className="w-4 h-4" /> Add policy
            </Button>
          ) : null
        }
      />

      <FormDrawer
        open={isAddingNew}
        onOpenChange={(v) => {
          if (!v) {
            resetForm();
            setIsAddingNew(false);
          }
        }}
        title="Add policy"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Policy type</Label>
            <Select
              value={form.type || undefined}
              onValueChange={(v) => setForm((p) => ({ ...p, type: v as PolicyType }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select policy type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TERMS_OF_USE">Terms of Use</SelectItem>
                <SelectItem value="PRIVACY_POLICY">Privacy Policy</SelectItem>
                <SelectItem value="SLA">SLA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Policy name</Label>
              <Input
                value={form.policyName}
                onChange={(e) => setForm((p) => ({ ...p, policyName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Effective date from</Label>
              <Input
                type="date"
                value={form.effectiveFrom}
                onChange={(e) => setForm((p) => ({ ...p, effectiveFrom: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Version name</Label>
              <Input
                value={form.versionName}
                onChange={(e) => setForm((p) => ({ ...p, versionName: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Policy text</Label>
            <PolicyRichTextEditor
              resetKey={editorKey}
              value={form.bodyHtml}
              onChange={(html) => setForm((p) => ({ ...p, bodyHtml: html }))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                setIsAddingNew(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Submit"}
            </Button>
          </div>
        </form>
      </FormDrawer>

      {!isAddingNew ? (
        <>
          <FilterBar
            search={{
              value: table.search,
              onChange: table.setSearch,
              placeholder: "Search policies",
            }}
          />
          <EntityListShell
            title="Policies"
            columns={columns}
            rows={filteredRows}
            isLoading={loading}
            rowKey={(r) => String(r.id)}
            sortBy={table.sortBy}
            sortDir={table.sortDir}
            onSort={table.setSort}
            emptyIcon={FileText}
            emptyTitle="No policies yet"
            emptyDescription="Add Terms of Use, Privacy Policy or SLA versions."
          />
        </>
      ) : null}
    </div>
  );
}
