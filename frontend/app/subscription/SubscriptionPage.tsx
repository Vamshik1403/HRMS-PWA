// app/subscription/page.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Icon } from "@iconify/react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  X,
  Save,
  RotateCcw,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { FormDrawer } from "../components/ui/form-drawer";

// ---------------------------
// Types
// ---------------------------
type ID = number;

interface Module {
  id: ID;
  moduleName: string;
  moduleKey: string;
}

interface AssignedModule {
  id: ID;
  planID: ID;
  moduleID: ID;
  module: Module;
}

interface Plan {
  id: ID;
  planName: string;
  validityDays: number;
  planAmount: number;
  assignedModules: AssignedModule[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface Company {
  id: ID;
  companyName: string;
}

interface Subscription {
  id: ID;
  companyID: ID;
  company?: Company;
  planID: ID;
  plan?: Plan;
  startDate: string;
  endDate: string;
  status: "ACTIVE" | "INACTIVE" | "EXPIRED" | "CANCELLED" | "RENEWED";
  deactivationWef?: string;
  deactivationReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ---------------------------
// API Helpers
// ---------------------------
const API = {
  plans: "/backend/subscription/plans",
  subscriptions: "/backend/subscription",
  company: "/backend/company",
  modules: "/backend/company/modules/all",
};

async function fetchJSONSafe<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Request failed: ${response.status}`);
  }
  const raw = await response.json();
  return (raw?.data ?? raw) as T;
}

// ---------------------------
// Component
// ---------------------------
export default function SubscriptionPage() {
  // Data
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // UI State
  const [activeTab, setActiveTab] = useState<"plans" | "subscriptions">("plans");
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination
  const [planPage, setPlanPage] = useState(1);
  const [subPage, setSubPage] = useState(1);
  const PAGE_SIZE = 10;

  // Plan Form State
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planForm, setPlanForm] = useState({
    planName: "",
    validityDays: 90,
    planAmount: 0,
    moduleIDs: [] as ID[],
    isActive: true,
  });

  // Subscription Form State
  const [showSubForm, setShowSubForm] = useState(false);
  const [subForm, setSubForm] = useState({
    companyID: 0,
    planID: 0,
    startDate: new Date().toISOString().split("T")[0],
  });

  // Deactivation State
  const [deactivatingSub, setDeactivatingSub] = useState<Subscription | null>(null);
  const [deactivationData, setDeactivationData] = useState({
    deactivationWef: new Date().toISOString().split("T")[0],
    reason: "",
  });

  // Renew State
  const [renewingSub, setRenewingSub] = useState<Subscription | null>(null);
  const [renewData, setRenewData] = useState({
    planID: 0,
    startDate: new Date().toISOString().split("T")[0],
  });

  // Stats
  const [stats, setStats] = useState({
    totalPlans: 0,
    activeAssignments: 0,
    expiringSoon: 0,
    totalRevenue: 0,
  });

  // ---------------------------
  // Data Loading
  // ---------------------------
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [plansData, subsData, companiesData, modulesData] = await Promise.all([
        fetchJSONSafe<Plan[]>(API.plans),
        fetchJSONSafe<Subscription[]>(API.subscriptions),
        fetchJSONSafe<Company[]>(API.company),
        fetchJSONSafe<Module[]>(API.modules),
      ]);

      setPlans(plansData || []);
      setSubscriptions(subsData || []);
      setCompanies(companiesData || []);
      setModules(modulesData || []);

      // Calculate stats
      const activeSubs = (subsData || []).filter((s) => s.status === "ACTIVE");
      const expiring = (subsData || []).filter((s) => {
        if (s.status !== "ACTIVE") return false;
        const endDate = new Date(s.endDate);
        const now = new Date();
        const diffDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= 30 && diffDays > 0;
      });

      setStats({
        totalPlans: (plansData || []).length,
        activeAssignments: activeSubs.length,
        expiringSoon: expiring.length,
        totalRevenue: (subsData || []).reduce((sum, s) => sum + (s.plan?.planAmount || 0), 0),
      });
    } catch (error: any) {
      toast.error(error?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---------------------------
  // Helpers
  // ---------------------------
  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      ACTIVE: { label: "Active", variant: "default" },
      INACTIVE: { label: "Inactive", variant: "secondary" },
      EXPIRED: { label: "Expired", variant: "destructive" },
      CANCELLED: { label: "Cancelled", variant: "destructive" },
      RENEWED: { label: "Renewed", variant: "outline" },
    };
    const c = config[status] || config.INACTIVE;
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const getCompanyName = (id: ID) => {
    const company = companies.find((c) => c.id === id);
    return company?.companyName || `#${id}`;
  };

  const getPlanName = (id: ID) => {
    const plan = plans.find((p) => p.id === id);
    return plan?.planName || `#${id}`;
  };

  const getPlanModules = (plan: Plan) => {
    return plan.assignedModules?.map((am) => am.module) || [];
  };

  // ---------------------------
  // Plan CRUD
  // ---------------------------
  const resetPlanForm = () => {
    setEditingPlan(null);
    setPlanForm({
      planName: "",
      validityDays: 90,
      planAmount: 0,
      moduleIDs: [],
      isActive: true,
    });
    setShowPlanForm(false);
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetchJSONSafe(API.plans, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planForm),
      });
      toast.success("Plan created successfully");
      resetPlanForm();
      loadData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to create plan");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    setSaving(true);
    try {
      await fetchJSONSafe(`${API.plans}/${editingPlan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planForm),
      });
      toast.success("Plan updated successfully");
      resetPlanForm();
      loadData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update plan");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async (id: ID) => {
    try {
      await fetchJSONSafe(`${API.plans}/${id}`, {
        method: "DELETE",
      });
      toast.success("Plan deleted successfully");
      loadData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete plan");
    }
  };

  const handleEditPlan = (plan: Plan) => {
    setEditingPlan(plan);
    setPlanForm({
      planName: plan.planName,
      validityDays: plan.validityDays,
      planAmount: plan.planAmount,
      moduleIDs: plan.assignedModules?.map((am) => am.moduleID) || [],
      isActive: plan.isActive,
    });
    setShowPlanForm(true);
  };

  // ---------------------------
  // Subscription CRUD
  // ---------------------------
  const resetSubForm = () => {
    setSubForm({
      companyID: 0,
      planID: 0,
      startDate: new Date().toISOString().split("T")[0],
    });
    setShowSubForm(false);
  };

  const handleAssignPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetchJSONSafe(API.subscriptions, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subForm),
      });
      toast.success("Plan assigned successfully");
      resetSubForm();
      loadData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to assign plan");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivatingSub) return;
    setSaving(true);
    try {
      await fetchJSONSafe(`${API.subscriptions}/${deactivatingSub.id}/deactivate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deactivationData),
      });
      toast.success("Subscription deactivated successfully");
      setDeactivatingSub(null);
      setDeactivationData({
        deactivationWef: new Date().toISOString().split("T")[0],
        reason: "",
      });
      loadData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to deactivate subscription");
    } finally {
      setSaving(false);
    }
  };

  const handleRenew = async () => {
    if (!renewingSub) return;
    setSaving(true);
    try {
      await fetchJSONSafe(`${API.subscriptions}/${renewingSub.id}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyID: renewingSub.companyID,
          planID: renewData.planID,
          startDate: renewData.startDate,
        }),
      });
      toast.success("Subscription renewed successfully");
      setRenewingSub(null);
      setRenewData({
        planID: 0,
        startDate: new Date().toISOString().split("T")[0],
      });
      loadData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to renew subscription");
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------
  // Filtering & Pagination
  // ---------------------------
  const filteredPlans = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();
    if (!search) return plans;
    return plans.filter(
      (p) =>
        p.planName.toLowerCase().includes(search) ||
        p.planAmount.toString().includes(search)
    );
  }, [plans, searchTerm]);

  const filteredSubscriptions = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();
    if (!search) return subscriptions;
    return subscriptions.filter(
      (s) =>
        getCompanyName(s.companyID).toLowerCase().includes(search) ||
        getPlanName(s.planID).toLowerCase().includes(search) ||
        s.status.toLowerCase().includes(search)
    );
  }, [subscriptions, searchTerm]);

  const paginatedPlans = useMemo(() => {
    const start = (planPage - 1) * PAGE_SIZE;
    return filteredPlans.slice(start, start + PAGE_SIZE);
  }, [filteredPlans, planPage]);

  const paginatedSubscriptions = useMemo(() => {
    const start = (subPage - 1) * PAGE_SIZE;
    return filteredSubscriptions.slice(start, start + PAGE_SIZE);
  }, [filteredSubscriptions, subPage]);

  const totalPlanPages = Math.ceil(filteredPlans.length / PAGE_SIZE);
  const totalSubPages = Math.ceil(filteredSubscriptions.length / PAGE_SIZE);

  const inlineFormOpen = showPlanForm || showSubForm;

  // Reset page when search changes
  useEffect(() => {
    setPlanPage(1);
    setSubPage(1);
  }, [searchTerm]);

  // ---------------------------
  // Render
  // ---------------------------
  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter py-6">
      {!inlineFormOpen && (
        <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Subscription Management</h1>
          <p className="text-muted-foreground text-sm">Manage subscription plans and assignments</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Plans</CardTitle>
            <Icon icon="mdi:package" className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPlans}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Assignments</CardTitle>
            <Icon icon="mdi:check-circle" className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeAssignments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <Icon icon="mdi:clock-alert" className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.expiringSoon}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <Icon icon="mdi:currency-inr" className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.totalRevenue.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <Button
          variant={activeTab === "plans" ? "default" : "ghost"}
          onClick={() => setActiveTab("plans")}
          className="rounded-none border-b-2 border-transparent data-[active=true]:border-primary"
        >
          <Icon icon="mdi:package-variant" className="w-4 h-4 mr-2" />
          Subscription Plans
        </Button>
        <Button
          variant={activeTab === "subscriptions" ? "default" : "ghost"}
          onClick={() => setActiveTab("subscriptions")}
          className="rounded-none border-b-2 border-transparent data-[active=true]:border-primary"
        >
          <Icon icon="mdi:clipboard-list" className="w-4 h-4 mr-2" />
          Assigned Subscriptions
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder={`Search ${activeTab === "plans" ? "plans..." : "subscriptions..."}`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        {activeTab === "plans" && !showPlanForm && (
          <Button onClick={() => { resetPlanForm(); setShowPlanForm(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Plan
          </Button>
        )}
        {activeTab === "subscriptions" && !showSubForm && (
          <Button onClick={() => { setShowSubForm(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Assign Plan
          </Button>
        )}
      </div>
        </>
      )}

      {/* Plan form — inline shell */}
      <FormDrawer
        open={showPlanForm}
        onOpenChange={(open) => { if (!open) resetPlanForm(); }}
        title={editingPlan ? "Edit Plan" : "Create New Plan"}
        description={editingPlan ? "Update subscription plan details." : "Fill in the details to create a new subscription plan."}
      >
                <form onSubmit={editingPlan ? handleUpdatePlan : handleCreatePlan} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Plan Name *</Label>
                      <Input
                        value={planForm.planName}
                        onChange={(e) => setPlanForm({ ...planForm, planName: e.target.value })}
                        placeholder="Enter plan name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Validity (Days) *</Label>
                      <Input
                        type="number"
                        value={planForm.validityDays}
                        onChange={(e) => setPlanForm({ ...planForm, validityDays: parseInt(e.target.value) || 0 })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Plan Amount (₹) *</Label>
                      <Input
                        type="number"
                        value={planForm.planAmount}
                        onChange={(e) => setPlanForm({ ...planForm, planAmount: parseFloat(e.target.value) || 0 })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={planForm.isActive ? "active" : "inactive"}
                        onValueChange={(v) => setPlanForm({ ...planForm, isActive: v === "active" })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Modules Included</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {modules.map((module) => (
                        <label key={module.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={planForm.moduleIDs.includes(module.id)}
                            onChange={(e) => {
                              setPlanForm({
                                ...planForm,
                                moduleIDs: e.target.checked
                                  ? [...planForm.moduleIDs, module.id]
                                  : planForm.moduleIDs.filter((id) => id !== module.id),
                              });
                            }}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm">{module.moduleName}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t">
                    <Button type="submit" disabled={saving}>
                      <Save className="w-4 h-4 mr-2" />
                      {saving ? "Saving..." : editingPlan ? "Update Plan" : "Create Plan"}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetPlanForm}>
                      Cancel
                    </Button>
                  </div>
                </form>
      </FormDrawer>

      {/* Assign plan form — inline shell */}
      <FormDrawer
        open={showSubForm}
        onOpenChange={(open) => { if (!open) resetSubForm(); }}
        title="Assign Plan to Company"
        description="Select a company and plan to create a new subscription assignment."
      >
                <form onSubmit={handleAssignPlan} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Company *</Label>
                      <Select
                        value={subForm.companyID.toString()}
                        onValueChange={(v) => setSubForm({ ...subForm, companyID: parseInt(v) })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select company" />
                        </SelectTrigger>
                        <SelectContent>
                          {companies.map((company) => (
                            <SelectItem key={company.id} value={company.id.toString()}>
                              {company.companyName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Plan *</Label>
                      <Select
                        value={subForm.planID.toString()}
                        onValueChange={(v) => setSubForm({ ...subForm, planID: parseInt(v) })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select plan" />
                        </SelectTrigger>
                        <SelectContent>
                          {plans
                            .filter((p) => p.isActive)
                            .map((plan) => (
                              <SelectItem key={plan.id} value={plan.id.toString()}>
                                {plan.planName} (₹{plan.planAmount})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Start Date *</Label>
                      <Input
                        type="date"
                        value={subForm.startDate}
                        onChange={(e) => setSubForm({ ...subForm, startDate: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4 border-t">
                    <Button type="submit" disabled={saving}>
                      <Plus className="w-4 h-4 mr-2" />
                      {saving ? "Assigning..." : "Assign Plan"}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetSubForm}>
                      Cancel
                    </Button>
                  </div>
                </form>
      </FormDrawer>

      {/* ==================== PLANS TAB ==================== */}
      {!inlineFormOpen && activeTab === "plans" && (
        <div className="space-y-4">
          {/* Plans Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Plans</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {filteredPlans.length} plan{filteredPlans.length !== 1 ? "s" : ""}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plan Name</TableHead>
                      <TableHead>Validity</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Modules</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : paginatedPlans.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <Icon icon="mdi:package" className="w-12 h-12 text-muted-foreground/50" />
                            <p>No plans found</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedPlans.map((plan) => (
                        <TableRow key={plan.id}>
                          <TableCell className="font-medium">{plan.planName}</TableCell>
                          <TableCell>{plan.validityDays} days</TableCell>
                          <TableCell>₹{plan.planAmount.toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {getPlanModules(plan).map((m) => (
                                <Badge key={m.id} variant="outline" className="text-xs">
                                  {m.moduleName}
                                </Badge>
                              ))}
                              {getPlanModules(plan).length === 0 && (
                                <span className="text-xs text-muted-foreground">No modules</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {plan.isActive ? (
                              <Badge variant="default">Active</Badge>
                            ) : (
                              <Badge variant="secondary">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditPlan(plan)}
                                className="h-8 w-8 p-0"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeletePlan(plan.id)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {filteredPlans.length > PAGE_SIZE && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <div className="text-sm text-muted-foreground">
                    Page {planPage} of {totalPlanPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPlanPage((p) => Math.max(1, p - 1))}
                      disabled={planPage <= 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPlanPage((p) => Math.min(totalPlanPages, p + 1))}
                      disabled={planPage >= totalPlanPages}
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================== SUBSCRIPTIONS TAB ==================== */}
      {!inlineFormOpen && activeTab === "subscriptions" && (
        <div className="space-y-4">
          {/* Subscriptions Grid */}
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : paginatedSubscriptions.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Icon icon="mdi:clipboard" className="w-12 h-12 text-muted-foreground/50" />
                    <p>No subscriptions found</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              paginatedSubscriptions.map((sub) => (
                <Card key={sub.id}>
                  <CardContent className="pt-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-2 flex-1 min-w-[200px]">
                        <div className="flex items-center gap-3">
                          <h4 className="font-semibold">{getCompanyName(sub.companyID)}</h4>
                          {getStatusBadge(sub.status)}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span>Plan: {getPlanName(sub.planID)}</span>
                          <span>•</span>
                          <span>Start: {new Date(sub.startDate).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>End: {new Date(sub.endDate).toLocaleDateString()}</span>
                          {sub.plan && (
                            <>
                              <span>•</span>
                              <span className="font-medium text-foreground">
                                ₹{sub.plan.planAmount.toLocaleString()}
                              </span>
                            </>
                          )}
                        </div>
                        {sub.deactivationReason && (
                          <div className="text-sm text-muted-foreground">
                            Reason: {sub.deactivationReason}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Deactivate Action */}
                        {sub.status === "ACTIVE" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setDeactivatingSub(sub);
                              setRenewingSub(null);
                            }}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Deactivate
                          </Button>
                        )}

                        {/* Renew Action */}
                        {(sub.status === "ACTIVE" || sub.status === "EXPIRED") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setRenewingSub(sub);
                              setRenewData({
                                planID: sub.planID,
                                startDate: new Date().toISOString().split("T")[0],
                              });
                              setDeactivatingSub(null);
                            }}
                          >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Renew
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Deactivation Form - Inline under card */}
                    {deactivatingSub?.id === sub.id && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Effective Date *</Label>
                            <Input
                              type="date"
                              value={deactivationData.deactivationWef}
                              onChange={(e) =>
                                setDeactivationData({ ...deactivationData, deactivationWef: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Reason *</Label>
                            <Input
                              value={deactivationData.reason}
                              onChange={(e) =>
                                setDeactivationData({ ...deactivationData, reason: e.target.value })
                              }
                              placeholder="Reason for deactivation"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button variant="destructive" size="sm" onClick={handleDeactivate} disabled={saving}>
                            {saving ? "Processing..." : "Confirm Deactivation"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setDeactivatingSub(null);
                              setDeactivationData({
                                deactivationWef: new Date().toISOString().split("T")[0],
                                reason: "",
                              });
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Renew Form - Inline under card */}
                    {renewingSub?.id === sub.id && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>New Plan *</Label>
                            <Select
                              value={renewData.planID.toString()}
                              onValueChange={(v) => setRenewData({ ...renewData, planID: parseInt(v) })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select plan" />
                              </SelectTrigger>
                              <SelectContent>
                                {plans
                                  .filter((p) => p.isActive)
                                  .map((plan) => (
                                    <SelectItem key={plan.id} value={plan.id.toString()}>
                                      {plan.planName} (₹{plan.planAmount})
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Start Date *</Label>
                            <Input
                              type="date"
                              value={renewData.startDate}
                              onChange={(e) => setRenewData({ ...renewData, startDate: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button size="sm" onClick={handleRenew} disabled={saving}>
                            {saving ? "Processing..." : "Confirm Renewal"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setRenewingSub(null);
                              setRenewData({
                                planID: 0,
                                startDate: new Date().toISOString().split("T")[0],
                              });
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}

            {/* Pagination */}
            {filteredSubscriptions.length > PAGE_SIZE && (
              <div className="flex items-center justify-between pt-4">
                <div className="text-sm text-muted-foreground">
                  Page {subPage} of {totalSubPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSubPage((p) => Math.max(1, p - 1))}
                    disabled={subPage <= 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSubPage((p) => Math.min(totalSubPages, p + 1))}
                    disabled={subPage >= totalSubPages}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}