"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { authHeaders } from "@/lib/auth";
import type { ModulePermission } from "@/lib/companyAccess";
import { Button } from "../ui/button";

type ModuleMeta = { moduleKey: string; label: string };

const ACTIONS: { key: keyof Pick<ModulePermission, "canView" | "canCreate" | "canEdit" | "canDelete">; label: string }[] = [
  { key: "canView", label: "View" },
  { key: "canCreate", label: "Create" },
  { key: "canEdit", label: "Edit" },
  { key: "canDelete", label: "Delete" },
];

/**
 * Inline Rights & Permissions editor for a single employee, embedded directly
 * inside the employee form modal (replaces the old standalone "select an
 * employee then tick modules" flow).
 */
export function EmployeeRightsPanel({ employeeId }: { employeeId: number }) {
  const [modules, setModules] = useState<ModuleMeta[]>([]);
  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers = authHeaders();
      const [modRes, permRes] = await Promise.all([
        fetch("/backend/employee-permissions/modules", { headers, cache: "no-store" }),
        fetch(`/backend/employee-permissions?employeeId=${employeeId}`, {
          headers,
          cache: "no-store",
        }),
      ]);
      if (modRes.ok) {
        const mods = await modRes.json();
        setModules(Array.isArray(mods) ? mods : []);
      }
      if (!permRes.ok) throw new Error(await permRes.text());
      const data = await permRes.json();
      setPermissions(Array.isArray(data.permissions) ? data.permissions : []);
      setReadOnly(!!data.readOnly);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load permissions");
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    if (employeeId) void load();
  }, [employeeId, load]);

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

  const toggleAll = (moduleKey: string) => {
    if (readOnly) return;
    setPermissions((prev) =>
      prev.map((row) => {
        if (row.moduleKey !== moduleKey) return row;
        const allOn = !!(row.canView && row.canCreate && row.canEdit && row.canDelete);
        const nextVal = !allOn;
        return { ...row, canView: nextVal, canCreate: nextVal, canEdit: nextVal, canDelete: nextVal };
      }),
    );
  };

  const save = async () => {
    if (readOnly) return;
    setSaving(true);
    try {
      const res = await fetch("/backend/employee-permissions", {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, permissions }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setPermissions(Array.isArray(data.permissions) ? data.permissions : permissions);
      toast.success("Permissions saved");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  const visiblePermissions = useMemo(() => {
    if (!modules.length) return permissions;
    const allowed = new Set(modules.map((m) => m.moduleKey));
    return permissions.filter((row) => allowed.has(row.moduleKey));
  }, [modules, permissions]);

  const labelFor = useMemo(() => {
    const map = new Map(modules.map((m) => [m.moduleKey, m.label]));
    return (key: string) => map.get(key) || key;
  }, [modules]);

  if (loading) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Loading permissions…</p>;
  }

  if (readOnly) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        This employee is the company owner — owner permissions are always full and cannot be edited.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {visiblePermissions.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-4 py-3 font-semibold">Module</th>
                <th className="px-3 py-3 font-semibold text-center">All</th>
                {ACTIONS.map((a) => (
                  <th key={a.key} className="px-3 py-3 font-semibold text-center">
                    {a.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visiblePermissions.map((row) => {
                const allChecked = !!(row.canView && row.canCreate && row.canEdit && row.canDelete);
                return (
                  <tr key={row.moduleKey} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-medium">{labelFor(row.moduleKey)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={allChecked}
                        aria-label={`Toggle all permissions for ${labelFor(row.moduleKey)}`}
                        onChange={() => toggleAll(row.moduleKey)}
                      />
                    </td>
                    {ACTIONS.map((a) => (
                      <td key={a.key} className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={!!row[a.key]}
                          onChange={() => toggle(row.moduleKey, a.key)}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-4">No modules available.</p>
      )}

      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save permissions"}
        </Button>
      </div>
    </div>
  );
}
