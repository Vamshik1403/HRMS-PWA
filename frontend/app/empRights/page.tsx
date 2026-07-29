"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import EmpMobileLayout from "@/app/components/layout/EmpMobileLayout";
import { useEmpPortalDesktop } from "@/app/components/layout/EmpPortalShell";
import { EmpDesktopPage } from "@/app/components/emp/desktop/EmpDesktopPage";
import { Button } from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { authHeaders } from "@/lib/auth";
import {
  canViewModule,
  isCompanyOwnerFlag,
  type ModulePermission,
} from "@/lib/companyAccess";
import { Shield } from "lucide-react";
import { useRouter } from "next/navigation";

type GrantableEmployee = {
  id: number;
  employeeCode?: string | null;
  name: string;
  isCompanyOwner?: boolean;
  ownerTitle?: string | null;
};

type ModuleMeta = { moduleKey: string; label: string };

const ACTIONS: { key: keyof Pick<ModulePermission, "canView" | "canCreate" | "canEdit" | "canDelete">; label: string }[] = [
  { key: "canView", label: "View" },
  { key: "canCreate", label: "Create" },
  { key: "canEdit", label: "Edit" },
  { key: "canDelete", label: "Delete" },
];

export default function EmpRightsPage() {
  const router = useRouter();
  const isDesktop = useEmpPortalDesktop();
  const allowed = isCompanyOwnerFlag() || canViewModule("RIGHTS");

  const [employees, setEmployees] = useState<GrantableEmployee[]>([]);
  const [modules, setModules] = useState<ModuleMeta[]>([]);
  const [employeeId, setEmployeeId] = useState<string>("");
  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!allowed) router.replace("/empdashboard");
  }, [allowed, router]);

  const loadMeta = useCallback(async () => {
    setLoading(true);
    try {
      const headers = authHeaders();
      const [empRes, modRes] = await Promise.all([
        fetch("/backend/employee-permissions/employees", { headers, cache: "no-store" }),
        fetch("/backend/employee-permissions/modules", { headers, cache: "no-store" }),
      ]);
      if (!empRes.ok) throw new Error(await empRes.text());
      const emps = await empRes.json();
      setEmployees(Array.isArray(emps) ? emps : []);
      if (modRes.ok) {
        const mods = await modRes.json();
        setModules(Array.isArray(mods) ? mods : []);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to load rights data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) void loadMeta();
  }, [allowed, loadMeta]);

  const loadForEmployee = useCallback(async (id: string) => {
    if (!id) {
      setPermissions([]);
      return;
    }
    try {
      const res = await fetch(`/backend/employee-permissions?employeeId=${id}`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setPermissions(Array.isArray(data.permissions) ? data.permissions : []);
      setReadOnly(!!data.readOnly);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load employee permissions");
    }
  }, []);

  useEffect(() => {
    if (employeeId) void loadForEmployee(employeeId);
  }, [employeeId, loadForEmployee]);

  const toggle = (moduleKey: string, field: (typeof ACTIONS)[number]["key"]) => {
    if (readOnly) return;
    setPermissions((prev) =>
      prev.map((row) => {
        if (row.moduleKey !== moduleKey) return row;
        const next = { ...row, [field]: !row[field] };
        if (field !== "canView" && next[field]) next.canView = true;
        if (field === "canView" && !next.canView) {
          next.canCreate = false;
          next.canEdit = false;
          next.canDelete = false;
        }
        return next;
      }),
    );
  };

  const save = async () => {
    if (!employeeId || readOnly) return;
    setSaving(true);
    try {
      const res = await fetch("/backend/employee-permissions", {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: Number(employeeId),
          permissions,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setPermissions(Array.isArray(data.permissions) ? data.permissions : permissions);
      toast.success("Permissions saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  const labelFor = useMemo(() => {
    const map = new Map(modules.map((m) => [m.moduleKey, m.label]));
    return (key: string) => map.get(key) || key;
  }, [modules]);

  const grantable = employees.filter((e) => !e.isCompanyOwner);

  const body = (
    <div className="space-y-6">
      <div className="max-w-md space-y-2">
        <Label>Employee</Label>
        <Select value={employeeId} onValueChange={setEmployeeId} disabled={loading}>
          <SelectTrigger>
            <SelectValue placeholder={loading ? "Loading…" : "Select employee"} />
          </SelectTrigger>
          <SelectContent>
            {grantable.map((e) => (
              <SelectItem key={e.id} value={String(e.id)}>
                {e.name}
                {e.employeeCode ? ` (${e.employeeCode})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {readOnly ? (
          <p className="text-xs text-muted-foreground">Owner permissions are always full and cannot be edited.</p>
        ) : null}
      </div>

      {employeeId && permissions.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-4 py-3 font-semibold">Module</th>
                {ACTIONS.map((a) => (
                  <th key={a.key} className="px-3 py-3 font-semibold text-center">
                    {a.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((row) => (
                <tr key={row.moduleKey} className="border-b last:border-0">
                  <td className="px-4 py-2.5 font-medium">{labelFor(row.moduleKey)}</td>
                  {ACTIONS.map((a) => (
                    <td key={a.key} className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={!!row[a.key]}
                        disabled={readOnly}
                        onChange={() => toggle(row.moduleKey, a.key)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {employeeId && !readOnly ? (
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save permissions"}
          </Button>
        </div>
      ) : null}
    </div>
  );

  if (!allowed) return null;

  if (isDesktop) {
    return (
      <EmpDesktopPage
        title="Rights & Permissions"
        description="Grant module access to employees in your company"
        icon={Shield}
      >
        {body}
      </EmpDesktopPage>
    );
  }

  return (
    <EmpMobileLayout>
      <div className="px-4 pt-6 pb-8 space-y-4">
        <h1 className="text-[22px] font-bold text-foreground">Rights & Permissions</h1>
        {body}
      </div>
    </EmpMobileLayout>
  );
}
