"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "../components/ui/dialog";
import { FormDrawer } from "../components/ui/form-drawer";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Icon } from "@iconify/react";
import { Plus, Search, Edit, Trash2, Play } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { toast } from "sonner";

/* ---------------- API endpoints ---------------- */
const API = {
  allocations: "/backend/bonus-allocation",
  employees: "/backend/manage-emp",
  bonusSetups: "/backend/bonus-setup",
  companies: "/backend/company",
  salaryCycle: "/backend/salary-cycle",
};
const MIN_CHARS = 1;

/* ---------------- Types ---------------- */
type ApiAllocation = {
  id: number;
  bonusSetupID: number;
  financialYear: number | null;
  salaryPeriod: number | null;
  employeeID: number;
  createdAt?: string;
  bonusSetup?: {
    id: number;
    bonusName: string | null;
    serviceProviderID: number | null;
    companyID: number | null;
    branchesID: number | null;
    bonusType: string | null;
    bonusDescription: string | null;
    bonusBasedOn: string | null;
    bonusPercentage: string | null;
    bonusFixed: string | null;
  } | null;
  manageEmployee?: {
    id: number;
    employeeID: string;
    employeeFirstName: string | null;
    employeeLastName: string | null;
    companyID?: number | null;
    branchesID?: number | null;
  } | null;
};

type EmployeeApi = {
  id: number;
  employeeID: string;
  employeeFirstName: string | null;
  employeeLastName: string | null;
  companyID?: number | null;
  branchesID?: number | null;
};

type BonusSetupApi = { 
  id: number; 
  bonusName: string | null;
  companyID?: number | null;
  branchesID?: number | null;
};

type CompanyApi = {
  id: number;
  companyName?: string | null;
  financialYearStart?: string | null;
};

type SalaryCycleApi = {
  id: number;
  monthStartDay?: string | null;
};

interface BonusAllocationUI {
  id: string;
  bonusSetupID: number;
  employeeDbID: number;
  bonusName: string;
  financialYearLabel: string;
  salaryPeriodLabel: string;
  employeeName: string;
  employeeCode: string;
  bonusAmount: number;
  createdAt: string;
  companyID?: number | null;
  branchesID?: number | null;
}

/* ---------------- Helpers ---------------- */
const monthsFull = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getCurrentYear() {
  return new Date().getFullYear();
}

function isJanStart(fyStart?: string | null) {
  return (fyStart ?? "").trim().toLowerCase() === "1st jan";
}

function buildFinancialYearOptions(financialYearStart?: string | null): string[] {
  const y = getCurrentYear();
  if (isJanStart(financialYearStart)) {
    return [String(y)];
  }
  return [`${y}-${y + 1}`];
}

function buildSalaryPeriods(financialYearStart?: string | null, monthStartDay?: string | null): string[] {
  const y = getCurrentYear();

  if (isJanStart(financialYearStart)) {
    return monthsFull.map((m) => `${m} ${y}`);
  }

  const start = parseInt(monthStartDay ?? "1", 10);
  if (!Number.isFinite(start) || start <= 1) {
    return monthsFull.map((m) => `${m} ${y}`);
  }

  const endDay = start - 1;
  const out: string[] = [];
  for (let i = 0; i < 12; i++) {
    const mIdx = i;
    const nextIdx = (mIdx + 1) % 12;
    const label = `${start} ${monthsShort[mIdx]} to ${endDay} ${monthsShort[nextIdx]}`;
    out.push(label);
  }
  return out;
}

function nameFromEmp(e?: { employeeFirstName: string | null; employeeLastName: string | null } | null) {
  const f = (e?.employeeFirstName ?? "").trim();
  const l = (e?.employeeLastName ?? "").trim();
  return [f, l].filter(Boolean).join(" ") || "-";
}

function inferFinancialYearLabelFromNumber(year?: number, financialYearStart?: string | null) {
  if (!year) return "-";
  if (isJanStart(financialYearStart)) return String(year);
  return `${year}-${year + 1}`;
}

function inferSalaryPeriodLabelFromNumber(m?: number, monthStartDay?: string | null, financialYearStart?: string | null) {
  if (!m || m < 1 || m > 12) return "-";
  const y = getCurrentYear();

  if (isJanStart(financialYearStart)) {
    return `${monthsFull[m - 1]} ${y}`;
  }

  const start = parseInt(monthStartDay ?? "1", 10);
  if (!Number.isFinite(start) || start <= 1) {
    return `${monthsFull[m - 1]} ${y}`;
  }
  const endDay = start - 1;
  const mIdx = m - 1;
  const nextIdx = (mIdx + 1) % 12;
  return `${start} ${monthsShort[mIdx]} to ${endDay} ${monthsShort[nextIdx]}`;
}

function parseFinancialYearLabelToYear(label: string): number | null {
  const m = label.match(/\b(20\d{2})\b/);
  return m ? parseInt(m[1], 10) : null;
}

function parseSalaryPeriodLabelToMonth(label: string): number | null {
  const lower = label.toLowerCase();
  for (let i = 0; i < 12; i++) {
    if (lower.includes(monthsFull[i].toLowerCase()) || lower.includes(monthsShort[i].toLowerCase())) {
      return i + 1;
    }
  }
  return null;
}

/* ---------------- Component ---------------- */
export function BonusAllocationsManagement() {
  const [allocations, setAllocations] = useState<BonusAllocationUI[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<BonusAllocationUI | null>(null);

  const user = useCurrentUser();
  const canManage = user?.role === "SUPERADMIN" || user?.role === "MANAGER";
  const isEmployee = user?.role === "EMPLOYEE";

  const [currentUserMapping, setCurrentUserMapping] = useState<any>(null);

  // Fetch mapping for MANAGER
  useEffect(() => {
    if (user?.role !== "MANAGER") return;

    (async () => {
      try {
        const res = await fetch("/backend/users");
        const list = await res.json();
        const me = list.find((u: any) => u.username === user.username);
        setCurrentUserMapping(me || null);
      } catch (e) {
        console.error("Mapping fetch failed", e);
      }
    })();
  }, [user]);

  const [empList, setEmpList] = useState<EmployeeApi[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [bonusList, setBonusList] = useState<BonusSetupApi[]>([]);
  const [bonusLoading, setBonusLoading] = useState(false);

  const empRef = useRef<HTMLDivElement | null>(null);
  const bonusRef = useRef<HTMLDivElement | null>(null);

  const [financialYearStart, setFinancialYearStart] = useState<string>("1st April");
  const [monthStartDay, setMonthStartDay] = useState<string>("1");
  const [financialYearOptions, setFinancialYearOptions] = useState<string[]>([]);
  const [salaryPeriodOptions, setSalaryPeriodOptions] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    bonusSetupID: null as number | null,
    employeeDbID: null as number | null,
    bonusAutocomplete: "",
    employeeAutocomplete: "",
    financialYearLabel: "",
    salaryPeriodLabel: "",
  });

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (empRef.current && !empRef.current.contains(t)) setEmpList([]);
      if (bonusRef.current && !bonusRef.current.contains(t)) setBonusList([]);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  useEffect(() => {
    if (user) loadAllocations();
  }, [user, currentUserMapping]);

  const loadAllocations = async () => {
    try {
      // Build URL with filters for MANAGER role
      let allocationsUrl = API.allocations;
      
      if (user?.role === "MANAGER" && currentUserMapping) {
        const params = new URLSearchParams();
        if (currentUserMapping.companyID) params.append('companyID', currentUserMapping.companyID.toString());
        if (currentUserMapping.branchesID) params.append('branchesID', currentUserMapping.branchesID.toString());
        
        const queryString = params.toString();
        if (queryString) {
          allocationsUrl += `?${queryString}`;
        }
      }

      const res = await fetch(allocationsUrl);
      const data: ApiAllocation[] = await res.json();

      const cRes = await fetch(API.companies);
      const companies: CompanyApi[] = await cRes.json();
      const fyStart = (companies?.[0]?.financialYearStart ?? "1st April") as string;

      const scRes = await fetch(API.salaryCycle);
      const cycles: SalaryCycleApi[] = await scRes.json();
      const mStart = (cycles?.[0]?.monthStartDay ?? "1") as string;

      // Additional client-side filtering for MANAGER role
      let filteredData = data;
      if (user?.role === "MANAGER" && currentUserMapping) {
        filteredData = data.filter(allocation => {
          const allocationCompanyID = allocation.bonusSetup?.companyID;
          const allocationBranchesID = allocation.bonusSetup?.branchesID;
          
          return allocationCompanyID === currentUserMapping.companyID && 
                 allocationBranchesID === currentUserMapping.branchesID;
        });
      }

      const all = filteredData.map((x) => ({
        id: String(x.id),
        bonusSetupID: x.bonusSetupID,
        employeeDbID: x.employeeID,
        bonusName: x.bonusSetup?.bonusName || "-",
        financialYearLabel: inferFinancialYearLabelFromNumber(x.financialYear ?? undefined, fyStart),
        salaryPeriodLabel: inferSalaryPeriodLabelFromNumber(x.salaryPeriod ?? undefined, mStart, fyStart),
        employeeName: nameFromEmp(x.manageEmployee),
        employeeCode: x.manageEmployee?.employeeID || "",
        bonusAmount: 0,
        createdAt: x.createdAt ? x.createdAt.split("T")[0] : new Date().toISOString().split("T")[0],
        companyID: x.bonusSetup?.companyID ?? null,
        branchesID: x.bonusSetup?.branchesID ?? null,
      }));

      // 🟢 SUPERADMIN — show all
      if (user?.role === "SUPERADMIN") {
        setAllocations(all);
        return;
      }

      // 🟡 MANAGER — filter from /users
      if (user?.role === "MANAGER") {
        const usersRes = await fetch("/backend/users");
        const users = await usersRes.json();
        const currentUser = users.find((u: any) => u.username === user.username);
        if (currentUser) {
          const filtered = all.filter(
            (a) =>
              a.companyID === currentUser.companyID &&
              a.branchesID === currentUser.branchesID
          );
          setAllocations(filtered);
          return;
        }
      }

      // 🔵 EMPLOYEE — filter from /manage-emp/credentials/all
      const credsRes = await fetch("/backend/manage-emp/credentials/all");
      const creds = await credsRes.json();
      const emp = creds.find((c: any) => c.username === user?.username);
      if (emp) {
        const filtered = all.filter(
          (a) =>
            a.companyID === emp.companyID &&
            a.branchesID === emp.branchesID
        );
        setAllocations(filtered);
      } else {
        setAllocations([]);
      }
    } catch (e) {
      console.error("Failed to load data", e);
      setAllocations([]);
    }
  };


  useEffect(() => {
    setFinancialYearOptions(buildFinancialYearOptions(financialYearStart));
    setSalaryPeriodOptions(buildSalaryPeriods(financialYearStart, monthStartDay));
  }, [financialYearStart, monthStartDay]);

  async function robustGet(url: string, q?: string) {
    try {
      const res = await fetch(q ? `${url}?q=${encodeURIComponent(q)}` : url);
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    } catch {
      const res2 = await fetch(url);
      if (!res2.ok) throw new Error(String(res2.status));
      return res2.json();
    }
  }

  const runFetchEmployees = debounce(async (val: string) => {
    if (!val || val.length < MIN_CHARS) return setEmpList([]);
    setEmpLoading(true);
    try {
      // Build URL with filters for MANAGER role
      let employeesUrl = API.employees;
      
      if (user?.role === "MANAGER" && currentUserMapping) {
        const params = new URLSearchParams();
        if (currentUserMapping.companyID) params.append('companyID', currentUserMapping.companyID.toString());
        if (currentUserMapping.branchesID) params.append('branchesID', currentUserMapping.branchesID.toString());
        
        const queryString = params.toString();
        if (queryString) {
          employeesUrl += `?${queryString}`;
        }
      }

      const list: EmployeeApi[] = await robustGet(employeesUrl, val);
      
      // Additional client-side filtering for MANAGER role
      let filtered = list;
      if (user?.role === "MANAGER" && currentUserMapping) {
        filtered = list.filter(employee => {
          return employee.companyID === currentUserMapping.companyID && 
                 employee.branchesID === currentUserMapping.branchesID;
        });
      }

      const lc = val.toLowerCase();
      filtered = filtered.filter((e) => {
        const nm = `${(e.employeeFirstName ?? "").trim()} ${(e.employeeLastName ?? "").trim()}`.trim().toLowerCase();
        return nm.includes(lc) || (e.employeeID ?? "").toLowerCase().includes(lc);
      });
      
      setEmpList(filtered.slice(0, 50));
    } catch (e) {
      console.error("Employees fetch error", e);
      setEmpList([]);
    } finally {
      setEmpLoading(false);
    }
  }, 250);

  const runFetchBonus = debounce(async (val: string) => {
    if (!val || val.length < MIN_CHARS) return setBonusList([]);
    setBonusLoading(true);
    try {
      // Build URL with filters for MANAGER role
      let bonusUrl = API.bonusSetups;
      
      if (user?.role === "MANAGER" && currentUserMapping) {
        const params = new URLSearchParams();
        if (currentUserMapping.companyID) params.append('companyID', currentUserMapping.companyID.toString());
        if (currentUserMapping.branchesID) params.append('branchesID', currentUserMapping.branchesID.toString());
        
        const queryString = params.toString();
        if (queryString) {
          bonusUrl += `?${queryString}`;
        }
      }

      const list: BonusSetupApi[] = await robustGet(bonusUrl, val);
      
      // Additional client-side filtering for MANAGER role
      let filtered = list;
      if (user?.role === "MANAGER" && currentUserMapping) {
        filtered = list.filter(bonus => {
          return bonus.companyID === currentUserMapping.companyID && 
                 bonus.branchesID === currentUserMapping.branchesID;
        });
      }

      const lc = val.toLowerCase();
      filtered = filtered.filter((b) => (b.bonusName ?? "").toLowerCase().includes(lc));
      
      setBonusList(filtered.slice(0, 50));
    } catch (e) {
      console.error("Bonus fetch error", e);
      setBonusList([]);
    } finally {
      setBonusLoading(false);
    }
  }, 250);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.bonusSetupID || !formData.employeeDbID) return;

    const payload = {
      bonusSetupID: formData.bonusSetupID,
      employeeID: formData.employeeDbID,
      financialYear: parseFinancialYearLabelToYear(formData.financialYearLabel),
      salaryPeriod: parseSalaryPeriodLabelToMonth(formData.salaryPeriodLabel),
    };

    try {
      if (editingAllocation) {
        const res = await fetch(`${API.allocations}/${editingAllocation.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const updated: ApiAllocation = await res.json();

        // CORRECTED: Update with proper data mapping
        const updatedAllocation: BonusAllocationUI = {
          id: String(updated.id),
          bonusSetupID: updated.bonusSetupID,
          employeeDbID: updated.employeeID,
          bonusName: updated.bonusSetup?.bonusName || "-",
          financialYearLabel: inferFinancialYearLabelFromNumber(updated.financialYear ?? undefined, financialYearStart),
          salaryPeriodLabel: inferSalaryPeriodLabelFromNumber(updated.salaryPeriod ?? undefined, monthStartDay, financialYearStart),
          employeeName: nameFromEmp(updated.manageEmployee),
          employeeCode: updated.manageEmployee?.employeeID || "",
          bonusAmount: 0,
          createdAt: updated.createdAt ? updated.createdAt.split("T")[0] : new Date().toISOString().split("T")[0],
        };

        setAllocations((prev) => prev.map((a) => a.id === String(updated.id) ? updatedAllocation : a));
      } else {
        const res = await fetch(API.allocations, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const created: ApiAllocation = await res.json();

        // CORRECTED: Create with proper data mapping
        const newAllocation: BonusAllocationUI = {
          id: String(created.id),
          bonusSetupID: created.bonusSetupID,
          employeeDbID: created.employeeID,
          bonusName: created.bonusSetup?.bonusName || "-",
          financialYearLabel: inferFinancialYearLabelFromNumber(created.financialYear ?? undefined, financialYearStart),
          salaryPeriodLabel: inferSalaryPeriodLabelFromNumber(created.salaryPeriod ?? undefined, monthStartDay, financialYearStart),
          employeeName: nameFromEmp(created.manageEmployee),
          employeeCode: created.manageEmployee?.employeeID || "",
          bonusAmount: 0,
          createdAt: created.createdAt ? created.createdAt.split("T")[0] : new Date().toISOString().split("T")[0],
        };

        setAllocations((prev) => [newAllocation, ...prev]);
      }
      resetForm();
      setIsDialogOpen(false);
      toast.success("Bonus allocation saved successfully");
    } catch (e) {
      console.error("Save failed", e);
      toast.error((e as any)?.message || "Failed to save bonus allocation");
    }
  };

  const handleEdit = (allocation: BonusAllocationUI) => {
    // CORRECTED: Set form data with proper values for edit modal
    setFormData({
      bonusSetupID: allocation.bonusSetupID,
      employeeDbID: allocation.employeeDbID,
      bonusAutocomplete: allocation.bonusName,
      employeeAutocomplete: `${allocation.employeeName}${allocation.employeeCode ? ` (${allocation.employeeCode})` : ""}`,
      financialYearLabel: allocation.financialYearLabel,
      salaryPeriodLabel: allocation.salaryPeriodLabel,
    });
    setEditingAllocation(allocation);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${API.allocations}/${id}`, { method: "DELETE" });
      setAllocations((prev) => prev.filter((a) => a.id !== id));
      toast.success("Bonus allocation deleted successfully");
    } catch (e) {
      console.error("Delete failed", e);
      toast.error((e as any)?.message || "Failed to delete bonus allocation");
    }
  };

  const resetForm = () => {
    setFormData({
      bonusSetupID: null,
      employeeDbID: null,
      bonusAutocomplete: "",
      employeeAutocomplete: "",
      financialYearLabel: "",
      salaryPeriodLabel: "",
    });
    setEditingAllocation(null);
    setEmpList([]);
    setBonusList([]);
  };

  const filteredAllocations = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return allocations.filter(
      (a) =>
        a.bonusName.toLowerCase().includes(q) ||
        a.employeeName.toLowerCase().includes(q) ||
        a.employeeCode.toLowerCase().includes(q) ||
        a.financialYearLabel.toLowerCase().includes(q) ||
        a.salaryPeriodLabel.toLowerCase().includes(q),
    );
  }, [allocations, searchTerm]);

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto px-4">
      <FormDrawer
        open={isDialogOpen}
        onOpenChange={(o) => { setIsDialogOpen(o); if (!o) resetForm(); }}
        title={editingAllocation ? "Edit Bonus Allocation" : "Add New Bonus Allocation"}
        description={editingAllocation ? "Update the bonus allocation information below." : "Fill in the details to add a new bonus allocation."}
      >
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Bonus Configuration</h3>
                  <div ref={bonusRef} className="space-y-2 relative">
                    <Label>Bonus Name *</Label>
                    <Input
                      value={formData.bonusAutocomplete}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((p) => ({ ...p, bonusAutocomplete: val, bonusSetupID: null }));
                        runFetchBonus(val);
                      }}
                      onFocus={(e) => {
                        const val = e.target.value;
                        if (val.length >= MIN_CHARS) runFetchBonus(val);
                      }}
                      placeholder="Start typing bonus name…"
                      autoComplete="off"
                      required
                    />
                    {bonusList.length > 0 && (
                      <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                        {bonusLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                        {bonusList.map((b) => (
                          <div
                            key={b.id}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setFormData((p) => ({
                                ...p,
                                bonusSetupID: b.id,
                                bonusAutocomplete: b.bonusName ?? "",
                              }));
                              setBonusList([]);
                            }}
                          >
                            {b.bonusName}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Period Configuration</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="financialYear">Financial Year *</Label>
                      <select
                        id="financialYear"
                        value={formData.financialYearLabel}
                        onChange={(e) => setFormData((p) => ({ ...p, financialYearLabel: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-sm border-[#d0d0d0] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 focus-visible:border-[#b0b0b0]"
                        required
                      >
                        <option value="">Select Financial Year</option>
                        {financialYearOptions.map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="salaryPeriod">Salary Period *</Label>
                      <select
                        id="salaryPeriod"
                        value={formData.salaryPeriodLabel}
                        onChange={(e) => setFormData((p) => ({ ...p, salaryPeriodLabel: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-sm border-[#d0d0d0] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 focus-visible:border-[#b0b0b0]"
                        required
                      >
                        <option value="">Select Salary Period</option>
                        {salaryPeriodOptions.map((period) => (
                          <option key={period} value={period}>{period}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Employee Selection</h3>
                  <div ref={empRef} className="space-y-2 relative">
                    <Label>Employee *</Label>
                    <Input
                      value={formData.employeeAutocomplete}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((p) => ({ ...p, employeeAutocomplete: val, employeeDbID: null }));
                        runFetchEmployees(val);
                      }}
                      onFocus={(e) => {
                        const val = e.target.value;
                        if (val.length >= MIN_CHARS) runFetchEmployees(val);
                      }}
                      placeholder="Type name or employee code…"
                      autoComplete="off"
                      required
                    />
                    {empList.length > 0 && (
                      <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                        {empLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                        {empList.map((emp) => {
                          const name = `${(emp.employeeFirstName ?? "").trim()} ${(emp.employeeLastName ?? "").trim()}`.trim();
                          return (
                            <div
                              key={emp.id}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setFormData((p) => ({
                                  ...p,
                                  employeeDbID: emp.id,
                                  employeeAutocomplete: name ? `${name} (${emp.employeeID})` : `(${emp.employeeID})`,
                                }));
                                setEmpList([]);
                              }}
                            >
                              {name || "(No name)"} <span className="text-gray-500">({emp.employeeID})</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingAllocation ? "Update Bonus Allocation" : "Add Bonus Allocation"}
                  </Button>
                </div>
              </form>
      </FormDrawer>

      {!isDialogOpen && (
      <>
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <p className="text-gray-600 mt-1 text-sm">Manage bonus allocations</p>
        </div>
        {canManage && (
          <Button
            onClick={() => { resetForm(); setIsDialogOpen(true); }}
            className="flex-shrink-0 text-sm px-3 py-2"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Bonus Allocation
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4 w-full">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search bonus allocations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
              {filteredAllocations.length} allocations
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="mdi:trophy-outline" className="w-5 h-5" />
            Bonus Allocations List
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 w-full">
          <div className="overflow-x-auto w-full">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Bonus Name</TableHead>
                  <TableHead className="w-[120px]">Financial Year</TableHead>
                  <TableHead className="w-[160px]">Salary Period</TableHead>
                  <TableHead className="w-[150px]">Employee Name</TableHead>
                  <TableHead className="w-[100px]">Employee ID</TableHead>
                  <TableHead className="w-[100px]">Created</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAllocations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Icon icon="mdi:trophy-outline" className="w-12 h-12 text-gray-300" />
                        <p>No bonus allocations found</p>
                        <p className="text-sm">Try adjusting your search criteria</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAllocations.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium whitespace-nowrap">{a.bonusName}</TableCell>
                      <TableCell className="whitespace-nowrap">{a.financialYearLabel}</TableCell>
                      <TableCell className="whitespace-nowrap">{a.salaryPeriodLabel}</TableCell>
                      <TableCell className="whitespace-nowrap">{a.employeeName}</TableCell>
                      <TableCell className="whitespace-nowrap">{a.employeeCode}</TableCell>
                      <TableCell className="whitespace-nowrap">{a.createdAt}</TableCell>
                      {canManage && (
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(a)}
                              className="h-7 w-7 p-0"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(a.id)}
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      )}

                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </>
      )}
    </div>
  );
}

function debounce<T extends (...args: any[]) => any>(fn: T, ms = 300) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}