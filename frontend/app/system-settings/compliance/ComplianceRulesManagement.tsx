"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { FormDrawer } from "../../components/ui/form-drawer";
import { EmpDesktopPage } from "../../components/emp/desktop/EmpDesktopPage";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { isCompanyOwnerFlag, canViewModule, isCompanyAdminLikeRole } from "@/lib/companyAccess";

const RULES_API = "/backend/compliance-rules";
const COMPANIES_API = "/backend/company";

interface CompanyRow {
  id: number;
  companyName?: string | null;
}

interface ComplianceRuleRow {
  id: number;
  serviceProviderID?: number | null;
  companyID?: number | null;
  ruleText: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  company?: { companyName?: string | null } | null;
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-7 w-14 items-center rounded-full border transition-colors ${checked ? "border-emerald-500 bg-emerald-500" : "border-gray-300 bg-gray-200"}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-8" : "translate-x-1"}`}
      />
    </button>
  );
}

export function ComplianceRulesManagement() {
  const user = useCurrentUser();
  const canAccess =
    user?.role === "SUPERADMIN" ||
    isCompanyAdminLikeRole(user?.role) ||
    (user?.role === "EMPLOYEE" && (isCompanyOwnerFlag() || canViewModule("SETTINGS")));
  const isSuperAdmin = user?.role === "SUPERADMIN";

  const [rules, setRules] = useState<ComplianceRuleRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [form, setForm] = useState({
    ruleText: "",
    companyID: "global",
    isActive: false,
  });

  const fetchRules = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const query = !isSuperAdmin && user.companyID ? `?companyID=${user.companyID}` : "";
      const res = await fetch(`${RULES_API}${query}`, { cache: "no-store" });
      const data = await res.json();
      setRules(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load compliance rules", error);
      setRules([]);
      toast.error("Failed to load compliance rules");
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    if (!isSuperAdmin) return;
    try {
      const res = await fetch(COMPANIES_API, { cache: "no-store" });
      const data = await res.json();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load companies", error);
      setCompanies([]);
    }
  };

  useEffect(() => {
    if (!canAccess) return;
    fetchRules();
    fetchCompanies();
  }, [canAccess, isSuperAdmin, user?.companyID]);

  const visibleRules = useMemo(() => {
    if (!isSuperAdmin || companyFilter === "all") return rules;
    if (companyFilter === "global") return rules.filter((rule) => !rule.companyID);
    return rules.filter((rule) => String(rule.companyID ?? "") === companyFilter);
  }, [companyFilter, isSuperAdmin, rules]);

  const resetForm = () => {
    setForm({
      ruleText: "",
      companyID: isSuperAdmin ? "global" : String(user?.companyID ?? "global"),
      isActive: false,
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ruleText.trim()) {
      toast.error("Rule text is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ruleText: form.ruleText.trim(),
        isActive: form.isActive,
        companyID: isSuperAdmin
          ? (form.companyID !== "global" ? Number(form.companyID) : undefined)
          : user?.companyID,
        serviceProviderID: user?.serviceProviderID,
      };

      const res = await fetch(RULES_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      toast.success("Compliance rule created");
      setIsDrawerOpen(false);
      resetForm();
      await fetchRules();
    } catch (error) {
      console.error("Failed to create compliance rule", error);
      toast.error("Failed to create compliance rule");
    } finally {
      setSaving(false);
    }
  };

  const toggleRule = async (rule: ComplianceRuleRow) => {
    try {
      const res = await fetch(`${RULES_API}/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      if (!res.ok) throw new Error(await res.text());
      setRules((current) => current.map((row) => row.id === rule.id ? { ...row, isActive: !row.isActive } : row));
    } catch (error) {
      console.error("Failed to update compliance rule", error);
      toast.error("Failed to update rule state");
    }
  };

  const deleteRule = async (ruleID: number) => {
    if (!window.confirm("Delete this compliance rule?")) return;
    try {
      const res = await fetch(`${RULES_API}/${ruleID}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setRules((current) => current.filter((row) => row.id !== ruleID));
      toast.success("Compliance rule deleted");
    } catch (error) {
      console.error("Failed to delete compliance rule", error);
      toast.error("Failed to delete compliance rule");
    }
  };

  if (!canAccess) {
    return <div className="p-8 text-center text-gray-500">Access restricted.</div>;
  }

  const addRuleButton = (
    <Button
      onClick={() => {
        resetForm();
        setIsDrawerOpen(true);
      }}
      className="text-sm px-4 py-2"
    >
      <Plus className="w-4 h-4 mr-1" />
      Add Rule
    </Button>
  );

  return (
    <EmpDesktopPage
      title="Compliance"
      description="Create compliance rules, review them in one place, and turn each rule on or off with a single toggle."
      icon={ShieldCheck}
      actions={
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-border bg-card px-4 py-2 text-center shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Rules</div>
            <div className="text-lg font-semibold text-foreground leading-tight">{rules.length}</div>
          </div>
          {addRuleButton}
        </div>
      }
    >
      <div className="space-y-6 w-full max-w-none">
      {isSuperAdmin && !isDrawerOpen && (
        <Card className="border-border shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Label htmlFor="companyFilter" className="min-w-fit text-muted-foreground">Company Filter</Label>
              <select
                id="companyFilter"
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="w-full sm:w-72 h-11 px-3 py-2 text-sm border rounded-xl border-border bg-background shadow-sm"
              >
                <option value="all">All Rules</option>
                <option value="global">Global Rules</option>
                {companies.map((company) => (
                  <option key={company.id} value={String(company.id)}>
                    {company.companyName || `Company ${company.id}`}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {!isDrawerOpen && (
      <div className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground shadow-sm">Loading rules...</div>
        ) : visibleRules.length === 0 ? (
          <Card className="border-dashed border-border shadow-none">
            <CardContent className="py-14 text-center text-sm text-muted-foreground">
              No compliance rules created yet.
            </CardContent>
          </Card>
        ) : (
          visibleRules.map((rule) => (
            <Card key={rule.id} className="border-border shadow-sm">
              <CardContent className="py-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-sm font-medium leading-6 text-foreground whitespace-pre-wrap">{rule.ruleText}</p>
                      <div className="flex shrink-0 items-center gap-3">
                        <div className="text-right">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Active</div>
                          <div className={`text-xs font-medium ${rule.isActive ? "text-emerald-600" : "text-muted-foreground"}`}>{rule.isActive ? "On" : "Off"}</div>
                        </div>
                        <ToggleSwitch checked={rule.isActive} onChange={() => toggleRule(rule)} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="px-2 py-1 rounded-full bg-muted text-foreground">
                        {rule.company?.companyName || "Global"}
                      </span>
                      <span className="px-2 py-1 rounded-full bg-muted text-foreground">
                        Created {new Date(rule.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 md:min-w-fit">
                    <Button type="button" variant="outline" onClick={() => deleteRule(rule.id)} className="border-border">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      )}

      <FormDrawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        title="Add Compliance Rule"
        description="Create a rule and choose whether it should start in the on or off state."
      >
        <form onSubmit={handleCreate} className="space-y-6 max-w-4xl">
          {isSuperAdmin && (
            <div className="space-y-2">
              <Label htmlFor="companyID">Company Scope</Label>
              <select
                id="companyID"
                value={form.companyID}
                onChange={(e) => setForm((current) => ({ ...current, companyID: e.target.value }))}
                className="w-full h-11 px-3 py-2 text-sm border rounded-xl border-slate-200 bg-white shadow-sm"
              >
                <option value="global">Global</option>
                {companies.map((company) => (
                  <option key={company.id} value={String(company.id)}>
                    {company.companyName || `Company ${company.id}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="ruleText">Rule</Label>
              <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
                <span>Default state</span>
                <ToggleSwitch
                  checked={form.isActive}
                  onChange={() => setForm((current) => ({ ...current, isActive: !current.isActive }))}
                />
              </div>
            </div>
            <Textarea
              id="ruleText"
              value={form.ruleText}
              onChange={(e) => setForm((current) => ({ ...current, ruleText: e.target.value }))}
              placeholder="Example: 'All employees must complete annual security training.'"
              className="min-h-40 rounded-2xl border-slate-200 bg-white px-4 py-3 shadow-sm"
              required
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="px-5">
              {saving ? "Saving..." : "Save Rule"}
            </Button>
          </div>
        </form>
      </FormDrawer>
      </div>
    </EmpDesktopPage>
  );
}
