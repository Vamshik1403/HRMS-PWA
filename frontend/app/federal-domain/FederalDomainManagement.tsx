"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/app/components/app/page-header";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { getActiveCompanyId, getSidebarContext } from "@/app/utils/sidebarContext";

type LinkedCompany = { id: number; companyName: string | null };
type SavedCode = {
  code: string;
  linkedCompanyCount: number;
  linkedCompanies: LinkedCompany[];
};
type FederalDomainData = {
  companyID: number;
  companyName: string | null;
  codes: SavedCode[];
  availableCodes: string[];
  linkedCompanies: { id: number; companyName: string | null; sharedCodes: string[] }[];
};

function authHeaders(): HeadersInit {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
      : "";
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

async function parseError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (Array.isArray(json.message)) return json.message.join(", ");
    return json.message || text || "Request failed";
  } catch {
    return text || "Request failed";
  }
}

export function FederalDomainManagement() {
  const user = useCurrentUser();
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [data, setData] = useState<FederalDomainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [fetchCode, setFetchCode] = useState("");

  const resolveCompanyId = useCallback(() => {
    return (
      getActiveCompanyId() ??
      getSidebarContext()?.companyID ??
      user?.activeCompanyID ??
      user?.companyID ??
      null
    );
  }, [user?.activeCompanyID, user?.companyID]);

  const load = useCallback(
    async (id: number) => {
      setLoading(true);
      try {
        const res = await fetch(`/backend/company/${id}/federal-domain`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error(await parseError(res));
        setData(await res.json());
      } catch (e: unknown) {
        setData(null);
        toast.error(e instanceof Error ? e.message : "Could not load Federal Domain");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const id = resolveCompanyId();
    const n = id != null ? Number(id) : NaN;
    if (!Number.isFinite(n) || n <= 0) {
      setCompanyId(null);
      setData(null);
      setLoading(false);
      return;
    }
    setCompanyId(n);
    void load(n);
  }, [load, resolveCompanyId]);

  useEffect(() => {
    const refresh = () => {
      const id = resolveCompanyId();
      const n = id != null ? Number(id) : NaN;
      if (Number.isFinite(n) && n > 0) {
        setCompanyId(n);
        void load(n);
      }
    };
    window.addEventListener("sidebar-context-changed", refresh);
    window.addEventListener("app-data-refresh", refresh);
    return () => {
      window.removeEventListener("sidebar-context-changed", refresh);
      window.removeEventListener("app-data-refresh", refresh);
    };
  }, [load, resolveCompanyId]);

  const saveCode = async (code: string) => {
    if (!companyId) return;
    const trimmed = code.trim();
    if (!trimmed) {
      toast.error("Enter a code or fetch an existing one");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/backend/company/${companyId}/federal-domain`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ code: trimmed }),
      });
      if (!res.ok) throw new Error(await parseError(res));
      setData(await res.json());
      setNewCode("");
      setFetchCode("");
      toast.success("Federal domain code saved");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not save code");
    } finally {
      setSaving(false);
    }
  };

  const removeCode = async (code: string) => {
    if (!companyId) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/backend/company/${companyId}/federal-domain?code=${encodeURIComponent(code)}`,
        { method: "DELETE", headers: authHeaders() },
      );
      if (!res.ok) throw new Error(await parseError(res));
      setData(await res.json());
      toast.success("Code removed");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not remove code");
    } finally {
      setSaving(false);
    }
  };

  if (!companyId) {
    return (
      <div className="page-content-enter w-full max-w-none animate-fade-in space-y-6">
        <PageHeader
          icon={Link2}
          title="Federal Domain"
          description="Select a company in the sidebar to manage linking codes."
        />
      </div>
    );
  }

  return (
    <div className="page-content-enter w-full max-w-none animate-fade-in space-y-6">
      <PageHeader
        icon={Link2}
        title="Federal Domain"
        description="Share the same code with another company so task assign lists can include both companies' employees in matching departments."
      />

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-6 max-w-2xl">
        <div>
          <p className="text-sm text-muted-foreground">
            Linking is mutual. Both companies must save the same code. One unused code links nobody.
            You can save more than one code to join multiple groups.
          </p>
          {data?.companyName ? (
            <p className="mt-2 text-sm font-medium text-foreground">{data.companyName}</p>
          ) : null}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Saved codes</Label>
              {!data?.codes.length ? (
                <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border px-3 py-4">
                  No codes yet. This company is not linked to any other company.
                </p>
              ) : (
                <ul className="space-y-2">
                  {data.codes.map((row) => (
                    <li
                      key={row.code}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-medium text-foreground">{row.code}</p>
                        {row.linkedCompanyCount > 0 ? (
                          <p className="text-xs text-emerald-700 mt-0.5">
                            Linked with{" "}
                            {row.linkedCompanies
                              .map((c) => c.companyName || `Company #${c.id}`)
                              .join(", ")}
                          </p>
                        ) : (
                          <p className="text-xs text-amber-700 mt-0.5">
                            Waiting — another company must save this same code
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={() => void removeCode(row.code)}
                        className="shrink-0 text-rose-700"
                      >
                        <Trash2 className="size-3.5" />
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {data?.linkedCompanies?.length ? (
              <p className="text-sm text-muted-foreground">
                Currently linked:{" "}
                {data.linkedCompanies
                  .map((c) => c.companyName || `Company #${c.id}`)
                  .join(", ")}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No mutual links yet. Task assign still shows only this company&apos;s employees.
              </p>
            )}

            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                void saveCode(newCode);
              }}
            >
              <Label htmlFor="federal-domain-new">Create a new code</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  id="federal-domain-new"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="e.g. enpl-3s"
                  disabled={saving}
                />
                <Button type="submit" disabled={saving} className="shrink-0">
                  <Plus className="size-4" />
                  Save
                </Button>
              </div>
            </form>

            <div className="space-y-2">
              <Label htmlFor="federal-domain-fetch">Fetch a code already used by another company</Label>
              {data?.availableCodes?.length ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    id="federal-domain-fetch"
                    value={fetchCode}
                    onChange={(e) => setFetchCode(e.target.value)}
                    disabled={saving}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Select a code</option>
                    {data.availableCodes.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving || !fetchCode}
                    onClick={() => void saveCode(fetchCode)}
                    className="shrink-0"
                  >
                    Add fetched code
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No other company has saved a code yet. Create one above, then save the same text in the other company.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default FederalDomainManagement;
