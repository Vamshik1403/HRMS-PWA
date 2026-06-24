"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { FormDrawer } from "../components/ui/form-drawer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Icon } from "@iconify/react";
import { Plus, Search, Edit, Trash2, Info, ArrowLeft, Filter, RotateCcw, X } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { toast } from "sonner";
import { getSidebarContext } from "../utils/sidebarContext";
import {
  canDesktopManagerManage,
  filterCompanyScopedRecords,
} from "../utils/scopeContext";
import { TableBodySkeleton } from "../components/ui/TableBodySkeleton";


/* ---------- Types ---------- */
interface Allowance {
  id: string;
  name: string;
  type: "Fixed" | "Percentage";
  value: number;
  isBonus?: boolean; // New field to identify bonus allowances
  bonusBasedOn?: string; // For bonus allowances
}

interface Deduction {
  id: string;
  name: string;
  type: "Fixed" | "Percentage";
  value: number;
}

type ApiAllowance = {
  id: number;
  salaryAllowanceName: string | null;
  salaryAllowanceType: string | null;
  salaryAllowanceValue: string | null;
  companyID?: number | null;
  branchesID?: number | null;
};

type ApiDeduction = {
  id: number;
  salaryDeductionName: string | null;
  salaryDeductionType: string | null;
  salaryDeductionValue: string | null;
  companyID?: number | null;
  branchesID?: number | null;
};

type ApiBonusAllocation = {
  id: number;
  bonusSetupID: number;
  financialYear: number | null;
  salaryPeriod: number | null;
  employeeID: number;
  bonusSetup?: {
    id: number;
    serviceProviderID: number | null;
    companyID: number | null;
    branchesID: number | null;
    bonusName: string | null;
    bonusType: string | null;
    bonusDescription: string | null;
    bonusBasedOn: string | null;
    bonusPercentage: string | null;
    bonusFixed: string | null;
  } | null;
};

type ApiMPG = {
  id: number;
  serviceProviderID: number | null;
  companyID: number | null;
  branchesID: number | null;
  monthlyPayGradeName: string | null;
  otStatus: boolean;
  otRate: string | null;
  miniOTTime: number | null;
  salType?: string | null;
  grossSalary: string | null;
  percentageOfBasic: string | null;
  basicSalary: number | null;
  serviceProvider?: { id: number; companyName?: string | null } | null;
  company?: { id: number; companyName?: string | null } | null;
  branches?: { id: number; branchName?: string | null } | null;
  monthlyPayGradeAllowanceList: { salaryAllowance?: ApiAllowance | null }[];
  monthlyPayGradeDeductionList: { salaryDeduction?: ApiDeduction | null }[];
  createdAt?: string;
};

interface MonthlyPayGradeUI {
  id: string;
  serviceProviderID: number | null;
  companyID: number | null;
  branchesID: number | null;
  serviceProvider: string;
  companyName: string;
  branchName: string;
  monthlyPayGradeName: string;
  otStatus: boolean;
  otRate: number;
  miniOTTime: number;
  grossSalary: number;
  salType: "Percentage" | "Fixed" | "-";
  percentageOfBasic: number;
  basicSalary: number;
  selectedAllowances: Allowance[];
  selectedDeductions: Deduction[];
  createdAt: string;
}

type SP = { id: number; companyName?: string | null };
type CO = { id: number; companyName?: string | null; serviceProviderID?: number | null };
type BR = { id: number; branchName?: string | null; companyID: number | null; branchesID: number | null };

/* ---------- API endpoints ---------- */
const API = {
  mpg: "/backend/monthly-pay-grade",
  allowances: "/backend/salary-allowance",
  deductions: "/backend/salary-deduction",
  bonusAllocations: "/backend/bonus-allocation", // New endpoint for bonuses
  serviceProviders: "/backend/service-provider",
  companies: "/backend/company",
  branches: "/backend/branches",
};

const MIN_CHARS = 0;
const EPS = 0.5;

/* ---------- Component ---------- */
export function MonthlyPayGradeManagement() {
  const [payGrades, setPayGrades] = useState<MonthlyPayGradeUI[]>([]);
  const [listLoading, setListLoading] = useState(true);
const [searchTerm, setSearchTerm] = useState("");

const [selectedFilterBranchIds, setSelectedFilterBranchIds] = useState<string[]>([]);
const [showBranchFilterModal, setShowBranchFilterModal] = useState(false);
const [branchFilterList, setBranchFilterList] = useState<any[]>([]);
const [branchFilterLoading, setBranchFilterLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPayGrade, setEditingPayGrade] = useState<MonthlyPayGradeUI | null>(null);

  const user = useCurrentUser();
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN" || canDesktopManagerManage(user);
  const isEmployee = user?.role === "EMPLOYEE";

  const [currentUserMapping, setCurrentUserMapping] = useState<any>(null);

  // Fetch mapping for MANAGER
  useEffect(() => {
    if (user?.role !== "SERVICE_PROVIDER") return;

    (async () => {
      try {
        const res = await fetch("/backend/users");
        const list = await res.json();
        const me = list.find((u: any) => u.username === user.username);
        setCurrentUserMapping(me || null);
      } catch (e) {
        console.error("Mapping fetch failed", e);
        toast.error("Failed to load data.");
      }
    })();
  }, [user]);

  // Auto-assign IDs for MANAGER
  useEffect(() => {
    if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
      setFormData((p) => ({
        ...p,
        serviceProviderID: currentUserMapping.serviceProviderID,
        companyID: currentUserMapping.companyID,
        branchesID: currentUserMapping.branchesID,
      }));
    }
  }, [user, currentUserMapping]);



  // fetched picklists
  const [allowanceList, setAllowanceList] = useState<Allowance[]>([]);
  const [deductionList, setDeductionList] = useState<Deduction[]>([]);
  const [bonusList, setBonusList] = useState<Allowance[]>([]); // New state for bonus allowances

  // --- FK autocomplete state ---
  const [spList, setSpList] = useState<SP[]>([]);
  const [coList, setCoList] = useState<CO[]>([]);
  const [brList, setBrList] = useState<BR[]>([]);
  const [spLoading, setSpLoading] = useState(false);
  const [coLoading, setCoLoading] = useState(false);
  const [brLoading, setBrLoading] = useState(false);
  const spRef = useRef<HTMLDivElement | null>(null);
  const coRef = useRef<HTMLDivElement | null>(null);
  const brRef = useRef<HTMLDivElement | null>(null);

  // form data (IDs + display strings)
  const [formData, setFormData] = useState({
    serviceProviderID: null as number | null,
    companyID: null as number | null,
    branchesID: null as number | null,
    spAutocomplete: "",
    coAutocomplete: "",
    brAutocomplete: "",
    monthlyPayGradeName: "",
    otRate: "",
    miniOTTime: 0,
    otStatus: false,
    otPayoutUnit: "Per Hour" as "Per Minute" | "Per Hour",
    salType: "Percentage" as "Percentage" | "Fixed",
    grossSalary: 0,
    percentageOfBasic: 0,
    basicSalary: 0,
    selectedAllowances: [] as Allowance[],
    selectedDeductions: [] as Deduction[],
    
  });

  /* ---------- Click outside to close suggestion boxes ---------- */
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (spRef.current && !spRef.current.contains(t)) setSpList([]);
      if (coRef.current && !coRef.current.contains(t)) setCoList([]);
      if (brRef.current && !brRef.current.contains(t)) setBrList([]);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  

  /* ---------- Initial load ---------- */
     
const loadBranchFilterList = async () => {
  try {
    setBranchFilterLoading(true);

    const res = await fetch(API.branches, { cache: "no-store" });
    const data = await res.json();
    const ctx = getSidebarContext();

    const activeCompanyID =
      ctx?.companyID ??
      user?.companyID ??
      currentUserMapping?.companyID ??
      formData.companyID ??
      null;

    let branches = Array.isArray(data) ? data : [];

    if (user?.role !== "SUPERADMIN" && activeCompanyID) {
      branches = branches.filter((b: any) => Number(b.companyID) === Number(activeCompanyID));
    }

    if (user?.role === "SUPERADMIN" && ctx?.companyID) {
      branches = branches.filter((b: any) => Number(b.companyID) === Number(ctx.companyID));
    }

    if (user?.role === "BRANCH_ADMIN") {
      const branchID = currentUserMapping?.branchesID ?? user?.branchesID;
      if (branchID) {
        branches = branches.filter((b: any) => Number(b.id) === Number(branchID));
        setSelectedFilterBranchIds([String(branchID)]);
      }
    }

    setBranchFilterList(branches);
  } catch (e) {
    console.error("Failed to load branch filter list:", e);
    setBranchFilterList([]);
  } finally {
    setBranchFilterLoading(false);
  }
};

useEffect(() => {
  (async () => {
    setListLoading(true);
    try {
      const res = await fetch(API.mpg);
      const data: ApiMPG[] = await res.json();

      const uiRows = data.map(mapApiToUi);
setPayGrades(await filterCompanyScopedRecords<MonthlyPayGradeUI>(uiRows, user));
await loadBranchFilterList();
    } catch (e) {
      console.error("Monthly pay grade fetch failed", e);
      toast.error("Failed to load data.");
      setPayGrades([]);
    } finally {
      setListLoading(false);
    }
  })();
}, [user, currentUserMapping]);

  useEffect(() => {
    const handler = () => {
      // Force re-run of the load useEffect by updating a dummy state
      if (user) {
        (async () => {
          try {
            const res = await fetch(API.mpg);
            const data: ApiMPG[] = await res.json();
            const uiRows = data.map(mapApiToUi);
            const ctx = getSidebarContext();
          if (ctx?.companyID) {
  setPayGrades(uiRows.filter((r: any) => Number(r.companyID) === Number(ctx.companyID)));
} else {
  setPayGrades(uiRows);
}
await loadBranchFilterList();

          } catch (e) {
            console.error("Monthly pay grade fetch failed", e);
          }
        })();
      }
    };
    window.addEventListener("sidebar-context-changed", handler);
    window.addEventListener("app-data-refresh", handler);
    return () => {
      window.removeEventListener("sidebar-context-changed", handler);
      window.removeEventListener("app-data-refresh", handler);
    };
  }, [user]);

      
      

      

const resolvedServiceProviderID =
  user?.role === "SERVICE_PROVIDER"
    ? currentUserMapping?.serviceProviderID
    : formData.serviceProviderID;

const resolvedCompanyID =
  user?.role === "SERVICE_PROVIDER"
    ? currentUserMapping?.companyID
    : formData.companyID;


const resolvedBranchID =
  user?.role === "SERVICE_PROVIDER"
    ? currentUserMapping?.branchesID
    : formData.branchesID;


  /* ---------- Derived calc ---------- */
  useEffect(() => {
    if (formData.salType === "Percentage") {
      const basic = (formData.grossSalary * formData.percentageOfBasic) / 100;
      setFormData((p) => ({ ...p, basicSalary: Math.round(basic * 100) / 100 || 0 }));
    }
  }, [formData.grossSalary, formData.percentageOfBasic, formData.salType]);

  /* ---------- Totals (live) ---------- */
  /* ---------- Totals (live) ---------- */
  const allowanceTotal = useMemo(() => {
    return formData.selectedAllowances.reduce((sum, a) => {
      // For regular allowances: Percentage is applied on Basic, Fixed is added directly
      // For bonus allowances: Apply percentage on the appropriate base (Basic/Gross)

      let baseAmount = formData.basicSalary;

      if (a.isBonus) {
        // Bonus allowances use Gross as base if bonusBasedOn is "Gross"
        baseAmount = a.bonusBasedOn === "Gross" ? formData.grossSalary : formData.basicSalary;
      } else {
        // Regular allowances always use Basic as base for percentage calculation
        baseAmount = formData.basicSalary;
      }

      const add = a.type === "Percentage" ? (baseAmount * a.value) / 100 : a.value;
      return sum + add;
    }, 0);
  }, [formData.selectedAllowances, formData.basicSalary, formData.grossSalary]);

  const expectedGrossFromBasicPlusAllowances = useMemo(() => {
    return Math.round((formData.basicSalary + allowanceTotal) * 100) / 100;
  }, [formData.basicSalary, allowanceTotal]);

  const deductionTotal = useMemo(() => {
    return formData.selectedDeductions.reduce((sum, d) => {
      const add = d.type === "Percentage" ? (formData.grossSalary * d.value) / 100 : d.value;
      return sum + add;
    }, 0);
  }, [formData.selectedDeductions, formData.grossSalary]);

  const netPayable = useMemo(() => {
    return Math.max(0, Math.round((formData.grossSalary - deductionTotal) * 100) / 100);
  }, [formData.grossSalary, deductionTotal]);

  const grossMatchesDerived = useMemo(() => {
    return Math.abs(formData.grossSalary - expectedGrossFromBasicPlusAllowances) <= EPS;
  }, [formData.grossSalary, expectedGrossFromBasicPlusAllowances]);

  useEffect(() => {
  if (!isDialogOpen) return;

  if (!resolvedCompanyID || !resolvedBranchID) {
    setAllowanceList([]);
    setDeductionList([]);
    setBonusList([]);
    return;
  }

  (async () => {
    try {
      const qs = `?companyID=${resolvedCompanyID}&branchesID=${resolvedBranchID}`;

      const [aRes, dRes, bonusRes] = await Promise.all([
        fetch(`${API.allowances}${qs}`),
        fetch(`${API.deductions}${qs}`),
        fetch(API.bonusAllocations),
      ]);

      const [aData, dData, bonusData]: [
        ApiAllowance[],
        ApiDeduction[],
        ApiBonusAllocation[]
      ] = await Promise.all([
        aRes.json(),
        dRes.json(),
        bonusRes.json(),
      ]);

      // ✅ Allowances
      setAllowanceList(
        aData
          .filter(
            a =>
              a.companyID === resolvedCompanyID &&
              a.branchesID === resolvedBranchID
          )
          .map(x => ({
            id: `allowance_${x.id}`,
            name: x.salaryAllowanceName ?? "-",
            type: x.salaryAllowanceType === "Percentage" ? "Percentage" : "Fixed",
            value: Number(x.salaryAllowanceValue) || 0,
            isBonus: false,
          }))
      );

      // ✅ Deductions
      setDeductionList(
        dData
          .filter(
            d =>
              d.companyID === resolvedCompanyID &&
              d.branchesID === resolvedBranchID
          )
          .map(x => ({
            id: `deduction_${x.id}`,
            name: x.salaryDeductionName ?? "-",
            type: x.salaryDeductionType === "Percentage" ? "Percentage" : "Fixed",
            value: Number(x.salaryDeductionValue) || 0,
          }))
      );

      // ✅ Bonuses (THIS WAS MISSING)
      setBonusList(
        bonusData
          .filter(
            b =>
              b.bonusSetup?.companyID === resolvedCompanyID &&
              b.bonusSetup?.branchesID === resolvedBranchID
          )
          .map(b => {
            const s = b.bonusSetup!;
            const isPct = s.bonusType === "Percentage";
            return {
              id: `bonus_${b.id}`,
              name: s.bonusName ?? "Bonus",
              type: isPct ? "Percentage" : "Fixed",
              value: isPct
                ? Number(s.bonusPercentage) || 0
                : Number(s.bonusFixed) || 0,
              isBonus: true,
              bonusBasedOn: s.bonusBasedOn ?? "Basic",
            };
          })
      );
    } catch (e) {
      console.error("Modal allowance/deduction fetch failed", e);
      toast.error("Failed to load data.");
    }
  })();
}, [isDialogOpen, resolvedCompanyID, resolvedBranchID]);


  /* ---------- Helpers ---------- */
  function safeParseNum(v: string | null | undefined, d = 0) {
    const n = parseFloat(v ?? "");
    return Number.isFinite(n) ? n : d;
  }

  function mapApiToUi(x: ApiMPG): MonthlyPayGradeUI {
    const allowances: Allowance[] = x.monthlyPayGradeAllowanceList
      .map((row) => row.salaryAllowance)
      .filter(Boolean)
      .map((a) => ({
        id: `allowance_${a!.id}`,
        name: a!.salaryAllowanceName ?? "-",
        type: (a!.salaryAllowanceType === "Percentage" ? "Percentage" : "Fixed") as "Fixed" | "Percentage",
        value: safeParseNum(a!.salaryAllowanceValue, 0),
        isBonus: false,
      }));

    const deductions: Deduction[] = x.monthlyPayGradeDeductionList
      .map((row) => row.salaryDeduction)
      .filter(Boolean)
      .map((d) => ({
        id: `deduction_${d!.id}`,
        name: d!.salaryDeductionName ?? "-",
        type: (d!.salaryDeductionType === "Percentage" ? "Percentage" : "Fixed") as "Fixed" | "Percentage",
        value: safeParseNum(d!.salaryDeductionValue, 0),
      }));

    return {
      id: String(x.id),
      serviceProviderID: x.serviceProviderID ?? null,
      companyID: x.companyID ?? null,
      branchesID: x.branchesID ?? null,
      serviceProvider: x.serviceProvider?.companyName ?? "-",
      companyName: x.company?.companyName ?? "-",
      branchName: x.branches?.branchName ?? "-",
      monthlyPayGradeName: x.monthlyPayGradeName ?? "-",
      otStatus: x.otStatus,
      otRate: safeParseNum(x.otRate, 0),
miniOTTime: x.miniOTTime ?? 0,
      salType: (x.salType === "Fixed" || x.salType === "Percentage") ? x.salType : "-",
      grossSalary: safeParseNum(x.grossSalary, 0),
      percentageOfBasic: safeParseNum(x.percentageOfBasic, 0),
      basicSalary: x.basicSalary ?? 0,
      selectedAllowances: allowances,
      selectedDeductions: deductions,
      createdAt: x.createdAt ? x.createdAt.split("T")[0] : new Date().toISOString().split("T")[0],
    };
  }

  function mapUiToPayload(fd: typeof formData) {
    // Separate regular allowances and bonuses
    const regularAllowanceIDs = fd.selectedAllowances
      .filter(a => !a.isBonus)
      .map(a => Number(a.id.replace('allowance_', '')));

    const bonusAllowanceIDs = fd.selectedAllowances
      .filter(a => a.isBonus)
      .map(a => Number(a.id.replace('bonus_', '')));

    return {
      serviceProviderID: fd.serviceProviderID,
      companyID: fd.companyID,
      branchesID: fd.branchesID,
      monthlyPayGradeName: fd.monthlyPayGradeName,
        otStatus: fd.otStatus,
        otRate: fd.otRate,
        miniOTTime: fd.miniOTTime,
      salType: fd.salType,
      grossSalary: String(fd.grossSalary),
      percentageOfBasic: fd.salType === "Percentage" ? String(fd.percentageOfBasic) : "0",
      basicSalary: fd.basicSalary,
      allowanceIDs: regularAllowanceIDs,
      bonusAllocationIDs: bonusAllowanceIDs, // New field for bonus allocations
      deductionIDs: fd.selectedDeductions.map((d) => Number(d.id.replace('deduction_', ''))),
    };
  }

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

  /* ---------- Debounced FK fetchers ---------- */
  const runFetchSP = debounce(async (val: string) => {
    if (!val || val.length < MIN_CHARS) return setSpList([]);
    setSpLoading(true);
    try {
      const list: SP[] = await robustGet(API.serviceProviders, val);
      const filtered = list.filter((x) => (x.companyName ?? "").toLowerCase().includes(val.toLowerCase()));
      setSpList(filtered.slice(0, 50));
    } catch (e) {
      console.error("SP fetch error", e);
      toast.error("Failed to load data.");
      setSpList([]);
    } finally {
      setSpLoading(false);
    }
  }, 250);



 const runFetchCO = debounce(async (val: string) => {
  if (!val || val.length < MIN_CHARS) return setCoList([]);

  // ❗ must know Service Provider
  if (!resolvedServiceProviderID) {
    setCoList([]);
    return;
  }

  setCoLoading(true);
  try {
    const list: CO[] = await robustGet(API.companies, val);

    const filtered = list.filter(
      (c) =>
        c.serviceProviderID === resolvedServiceProviderID &&
        (c.companyName ?? "").toLowerCase().includes(val.toLowerCase())
    );

    setCoList(filtered.slice(0, 50));
  } catch (e) {
    console.error("CO fetch error", e);
    toast.error("Failed to load data.");
    setCoList([]);
  } finally {
    setCoLoading(false);
  }
}, 250);


 const runFetchBR = debounce(async (val: string) => {
  if (!val || val.length < MIN_CHARS) return setBrList([]);

  // ❗ must know Company
  if (!resolvedCompanyID) {
    setBrList([]);
    return;
  }

  setBrLoading(true);
  try {
    const list: BR[] = await robustGet(API.branches, val);

    const filtered = list.filter(
      (b) =>
        b.companyID === resolvedCompanyID &&
        (user?.role !== "BRANCH_ADMIN" || Number(b.id) === Number(user?.branchesID)) &&
        (b.branchName ?? "").toLowerCase().includes(val.toLowerCase())
    );

    setBrList(filtered.slice(0, 50));
  } catch (e) {
    console.error("BR fetch error:", e);
    toast.error("Failed to load data.");
    setBrList([]);
  } finally {
    setBrLoading(false);
  }
}, 250);




  /* ---------- CRUD ---------- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const mismatch = Math.abs(formData.grossSalary - expectedGrossFromBasicPlusAllowances) > EPS;
    if (mismatch) {
      toast.error(
        `Gross Salary must equal Basic + Selected Allowances.\n\n` +
        `Gross Salary: ₹${formData.grossSalary.toFixed(2)}\n` +
        `Basic + Allowances: ₹${expectedGrossFromBasicPlusAllowances.toFixed(2)}`
      );
      return;
    }

    if (deductionTotal <= 0) {
      toast.error(`Total deductions must be greater than 0.`);
      return;
    }

    const payload = mapUiToPayload(formData);

    try {
      if (editingPayGrade) {
        const res = await fetch(`${API.mpg}/${editingPayGrade.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const updated: ApiMPG = await res.json();
        setPayGrades((prev) => prev.map((p) => (p.id === String(updated.id) ? mapApiToUi(updated) : p)));
      } else {
        const res = await fetch(API.mpg, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const created: ApiMPG = await res.json();
        setPayGrades((prev) => [mapApiToUi(created), ...prev]);
      }
      resetForm();
      setIsDialogOpen(false);
      toast.success(editingPayGrade ? "Updated successfully" : "Created successfully");
    } catch (e) {
      console.error("Save failed", e);
      toast.error("Failed to save. Please try again.");
    }
  };

  const handleEdit = (pg: MonthlyPayGradeUI) => {
    setFormData({
      serviceProviderID: pg.serviceProviderID,
      companyID: pg.companyID,
      branchesID: pg.branchesID,
      spAutocomplete: pg.serviceProvider || "",
      coAutocomplete: pg.companyName || "",
      brAutocomplete: pg.branchName || "",
      monthlyPayGradeName: pg.monthlyPayGradeName,
      otStatus: pg.otStatus,
      otRate: String(pg.otRate || 0),
      miniOTTime: pg.miniOTTime,
      otPayoutUnit: formData.otPayoutUnit,
      salType: pg.salType === "Fixed" || pg.salType === "Percentage" ? pg.salType : "Percentage",
      grossSalary: pg.grossSalary,
      percentageOfBasic: pg.percentageOfBasic,
      basicSalary: pg.basicSalary,
      selectedAllowances: pg.selectedAllowances,
      selectedDeductions: pg.selectedDeductions,
    });
    setEditingPayGrade(pg);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${API.mpg}/${id}`, { method: "DELETE" });
      setPayGrades((prev) => prev.filter((p) => p.id !== id));
      toast.success("Pay grade deleted successfully");
    } catch (e) {
      console.error("Delete failed", e);
      toast.error("Failed to delete. Please try again.");
    }
  };

  const resetForm = () => {
    const ctx = getSidebarContext();
    setFormData({
      serviceProviderID: ctx?.serviceProviderID ?? null,
      companyID: ctx?.companyID ?? null,
      branchesID: null,
      spAutocomplete: ctx?.serviceProviderName ?? "",
      coAutocomplete: ctx?.companyName ?? "",
      brAutocomplete: "",
      monthlyPayGradeName: "",
      otStatus: false,
      otRate: "",
      miniOTTime: 0,
      otPayoutUnit: "Per Hour" as "Per Minute" | "Per Hour",
      salType: "Percentage",
      grossSalary: 0,
      percentageOfBasic: 0,
      basicSalary: 0,
      selectedAllowances: [],
      selectedDeductions: [],
    });
    setEditingPayGrade(null);
    setSpList([]); setCoList([]); setBrList([]);
  };

  const handleAllowanceToggle = (allowance: Allowance) => {
    const isSelected = formData.selectedAllowances.some((a) => a.id === allowance.id);
    setFormData((prev) => ({
      ...prev,
      selectedAllowances: isSelected
        ? prev.selectedAllowances.filter((a) => a.id !== allowance.id)
        : [...prev.selectedAllowances, allowance],
    }));
  };

  const handleDeductionToggle = (deduction: Deduction) => {
    const isSelected = formData.selectedDeductions.some((d) => d.id === deduction.id);
    setFormData((prev) => ({
      ...prev,
      selectedDeductions: isSelected
        ? prev.selectedDeductions.filter((d) => d.id !== deduction.id)
        : [...prev.selectedDeductions, deduction],
    }));
  };

  const toggleFilterBranch = (branchId: string) => {
  setSelectedFilterBranchIds((prev) =>
    prev.includes(branchId)
      ? prev.filter((id) => id !== branchId)
      : [...prev, branchId]
  );
};

const selectAllFilterBranches = () => {
  setSelectedFilterBranchIds(branchFilterList.map((b: any) => String(b.id)));
};

const clearFilterBranches = () => {
  if (user?.role === "BRANCH_ADMIN") return;
  setSelectedFilterBranchIds([]);
};

const filteredPayGrades = useMemo(() => {
    const q = searchTerm.toLowerCase();

    return payGrades.filter((pg) => {
      const matchesBranch =
        selectedFilterBranchIds.length === 0 ||
        selectedFilterBranchIds.includes(String(pg.branchesID));

      const matchesSearch =
        !q ||
        pg.monthlyPayGradeName.toLowerCase().includes(q) ||
        pg.basicSalary.toString().toLowerCase().includes(q) ||
        pg.serviceProvider.toLowerCase().includes(q) ||
        pg.companyName.toLowerCase().includes(q) ||
        pg.branchName.toLowerCase().includes(q);

      return matchesBranch && matchesSearch;
    });
  }, [payGrades, searchTerm, selectedFilterBranchIds]);


  // Combine regular allowances and bonuses for display, HRA always first
  const allAllowances = [...allowanceList, ...bonusList].sort((a, b) => {
    const aIsHRA = a.name.toUpperCase().includes("HRA");
    const bIsHRA = b.name.toUpperCase().includes("HRA");
    if (aIsHRA && !bIsHRA) return -1;
    if (!aIsHRA && bIsHRA) return 1;
    return 0;
  });

  /* ---------- UI ---------- */
  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <p className="text-gray-600 mt-1 text-sm">Manage pay grades and salary structures</p>
        </div>
        {canManage && !isDialogOpen && (
          <Button
            onClick={() => { resetForm(); setIsDialogOpen(true); }}
            className="flex-shrink-0 text-sm px-3 py-2"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Paygrade
          </Button>
        )}
      </div>

      <FormDrawer open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) resetForm(); }} title={editingPayGrade ? "Edit Paygrade Setup" : "Add New Paygrade Setup"} description={editingPayGrade ? "Update the paygrade setup information below." : "Fill in the details to add a new paygrade setup."}>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information with AUTOCOMPLETE */}
              {/* SP/Company auto-filled from sidebar, Branch always visible */}
                <div className="grid grid-cols-1 gap-4">
                  {/* SP - auto-filled from sidebar */}
                  <div ref={spRef} className="space-y-2 relative hidden">
                    <Label>Service Provider *</Label>
                    <Input
                      value={formData.spAutocomplete}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((p) => ({ ...p, spAutocomplete: val, serviceProviderID: null }));
                        runFetchSP(val);
                      }}
                      placeholder="Start typing service provider…"
                      autoComplete="off"
                    />
                    {spList.length > 0 && (
                      <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                        {spList.map((sp) => (
                          <div
                            key={sp.id}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setFormData((p) => ({
                                ...p,
                                serviceProviderID: sp.id,
                                spAutocomplete: sp.companyName ?? "",
                              }));
                              setSpList([]);
                            }}
                          >
                            {sp.companyName}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Company - auto-filled from sidebar */}
                  <div ref={coRef} className="space-y-2 relative hidden">
                    <Label>Company *</Label>
                    <Input
                      value={formData.coAutocomplete}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((p) => ({ ...p, coAutocomplete: val, companyID: null }));
                        runFetchCO(val);
                      }}
                      placeholder="Start typing company…"
                      autoComplete="off"
                    />
                    {coList.length > 0 && (
                      <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                        {coList.map((co) => (
                          <div
                            key={co.id}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setFormData((p) => ({
                                ...p,
                                companyID: co.id,
                                coAutocomplete: co.companyName ?? "",
                              }));
                              setCoList([]);
                            }}
                          >
                            {co.companyName}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Branch */}
                  <div ref={brRef} className="space-y-2 relative">
                    <Label>Branch *</Label>
                    <Input
                      value={formData.brAutocomplete}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((p) => ({ ...p, brAutocomplete: val, branchesID: null }));
                        runFetchBR(val);
                      }}
                      placeholder="Start typing branch…"
                      autoComplete="off"
                    />
                    {brList.length > 0 && (
                      <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                        {brList.map((br) => (
                          <div
                            key={br.id}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setFormData((p) => ({
                                ...p,
                                branchesID: br.id,
                                brAutocomplete: br.branchName ?? "",
                              }));
                              setBrList([]);
                            }}
                          >
                            {br.branchName}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              {/* MANAGER → Only Branch input */}
              {user?.role === "SERVICE_PROVIDER" && (
                <div className="grid grid-cols-1 gap-4">
                  <div ref={brRef} className="space-y-2 relative">
                    <Label>Branch *</Label>
                    <Input
                      value={formData.brAutocomplete}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((p) => ({ ...p, brAutocomplete: val, branchesID: null }));
                        runFetchBR(val);
                      }}
                      placeholder="Start typing branch…"
                      autoComplete="off"
                    />
                    {brList.length > 0 && (
                      <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                        {brList.map((br) => (
                          <div
                            key={br.id}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setFormData((p) => ({
                                ...p,
                                branchesID: br.id,
                                brAutocomplete: br.branchName ?? "",
                              }));
                              setBrList([]);
                            }}
                          >
                            {br.branchName}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="monthlyPayGradeName">Paygrade Setup Name *</Label>
                <Input
                  id="monthlyPayGradeName"
                  value={formData.monthlyPayGradeName}
                  onChange={(e) => setFormData((p) => ({ ...p, monthlyPayGradeName: e.target.value }))}
                  placeholder="Enter paygrade setup name"
                  required
                />
              </div>



              {/* Salary Config */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Salary Configuration</h3>

                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="grossSalary">Gross Salary *</Label>
                    <span className="relative group">
                      <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
                        {`Manual Value — Total Salary inclusive of all Allowances and Deductions`}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      id="grossSalary"
                      type="text"
                      min="0"
                      step="0.01"
                      value={formData.grossSalary}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, grossSalary: parseFloat(e.target.value) || 0 }))
                      }
                      placeholder="0"
                      required
                    />
                    <span className="text-sm text-gray-500">₹</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-4">
                  {/* Percentage of Basic */}
                  <div className="space-y-2 flex-1 min-w-[150px]">
                    <Label htmlFor="percentageOfBasic">
                      % Of Basic {formData.salType === "Fixed" && "(disabled in Fixed)"}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="percentageOfBasic"
                        type="text"
                        min="0"
                        max="100"
                        step="0.01"
                        value={formData.percentageOfBasic}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, percentageOfBasic: parseFloat(e.target.value) || 0 }))
                        }
                        placeholder="0"
                        disabled={formData.salType === "Fixed"}
                        required={formData.salType === "Percentage"}
                      />
                      <span className="text-sm text-gray-500">%</span>
                    </div>
                  </div>

                  {/* Salary Type */}
                  <div className="space-y-2 flex-1 min-w-[150px]">
                    <Label htmlFor="salType">Select Type *</Label>
                    <select
                      id="salType"
                      value={formData.salType}
                      onChange={(e) => {
                        const val = e.target.value === "Fixed" ? "Fixed" : "Percentage";
                        setFormData((p) => ({ ...p, salType: val }));
                      }}
                      className="w-full border rounded-md px-3 py-2"
                    >
                      <option value="Percentage">Percentage</option>
                      <option value="Fixed">Fixed </option>
                    </select>
                  </div>

                  {/* Basic Salary */}
                  <div className="space-y-2 flex-1 min-w-[200px]">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="basicSalary">
                        Basic Salary {formData.salType === "Percentage" ? "(Calculated)" : "(Editable)"}
                      </Label>
                      <span className="relative group">
                        <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
                          {`Part of Basic Salary inclusive of DA (if DA apply) from Gross Salary`}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        id="basicSalary"
                        type="number"
                        step="0.01"
                        value={formData.basicSalary}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            basicSalary: parseFloat(e.target.value) || 0,
                          }))
                        }
                        readOnly={formData.salType === "Percentage"}
                        className={formData.salType === "Percentage" ? "bg-gray-100" : ""}
                      />
                      <span className="text-sm text-gray-500">₹</span>
                    </div>
                  </div>
                </div>
              </div>

              

              {/* OT Configuration */}
              <div className="space-y-4">
                <div className="flex items-center gap-1">
                  <h3 className="text-lg font-semibold">OT Configuration</h3>
                  <span className="relative group">
                    <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
                      {`Overtime Rate configuration`}
                    </span>
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="otStatus"
                    checked={formData.otStatus}
                    onChange={(e) => setFormData((p) => ({ ...p, otStatus: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <Label htmlFor="otStatus" className="text-sm font-medium">Overtime Applicable</Label>
                </div>

                {formData.otStatus && (
                  <div className="ml-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* OT Payout Unit */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <Label htmlFor="otPayoutUnit">OT Payout Unit</Label>
                        <span className="relative group">
                          <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
                            {`* OT Payout calculate as Per Minute Rate = (Gross Salary / Total Month's Day) / Total Workshift Hours in Minute\n* OT Payout calculate as Per Hour Rate = (Gross Salary / Total Month's Day) / Total Workshift Hours in Hours`}
                          </span>
                        </span>
                      </div>
                      <select
                        id="otPayoutUnit"
                        value={formData.otPayoutUnit}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            otPayoutUnit: e.target.value as "Per Minute" | "Per Hour",
                          }))
                        }
                        className="w-full border rounded-md px-3 py-2"
                      >
                        <option value="Per Minute">Per Minute</option>
                        <option value="Per Hour">Per Hour</option>
                      </select>
                    </div>

                    {/* OT Payout Rate */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <Label htmlFor="otRate">OT Payout Rate</Label>
                        <span className="relative group">
                          <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
                            {`OT Payout rate consider as multiply of this value.`}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          id="otRate"
                          type="text"
                          value={formData.otRate}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, otRate: e.target.value }))
                          }
                          placeholder="e.g. 2"
                          className="w-full"
                        />
                        <span className="text-sm text-gray-500 flex-shrink-0">x</span>
                      </div>
                      <p className="text-xs text-gray-500">e.g. 2x</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Allowance Selection */}
              <div className="space-y-4">
                <div className="flex items-center gap-1">
                  <h3 className="text-lg font-semibold">Allowance Selection</h3>
                  <span className="relative group">
                    <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
                      {`Part of Allowance from Gross Salary`}
                    </span>
                  </span>
                </div>
                <div className="border rounded-lg p-4 bg-gray-50">
                  <p className="text-sm text-gray-600 mb-4">Select allowances and bonuses for this pay grade:</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {allAllowances.map((allowance) => {
                      const isSelected = formData.selectedAllowances.some((a) => a.id === allowance.id);
                      const isBonus = allowance.isBonus;

                      // Calculate individual allowance amount for display
                      let baseAmount = formData.basicSalary;
                      if (isBonus && allowance.bonusBasedOn === "Gross") {
                        baseAmount = formData.grossSalary;
                      }

                      const allowanceAmount = allowance.type === "Percentage"
                        ? (baseAmount * allowance.value) / 100
                        : allowance.value;

                      return (
                        <div key={allowance.id} className="flex items-center space-x-3 p-2 hover:bg-gray-100 rounded">
                          <input
                            type="checkbox"
                            id={`allowance-${allowance.id}`}
                            checked={isSelected}
                            onChange={() => handleAllowanceToggle(allowance)}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`allowance-${allowance.id}`} className="font-medium cursor-pointer">
                                {allowance.name}
                              </Label>
                              {isBonus && (
                                <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">
                                  Bonus
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <span>
                                {allowance.type === "Percentage"
                                  ? `${allowance.value}% of ${isBonus && allowance.bonusBasedOn === "Gross" ? "Gross" : "Basic"} = ₹${allowanceAmount.toFixed(2)}`
                                  : `₹${allowance.value} (Fixed)`}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {allowance.type}
                              </Badge>
                              {isBonus && allowance.bonusBasedOn && (
                                <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800">
                                  Based on {allowance.bonusBasedOn}
                                </Badge>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <span className="text-sm font-medium text-green-600">
                              +₹{allowanceAmount.toFixed(2)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Detailed breakdown */}
                  <div className="mt-4 p-3 bg-white border rounded">
                    <h4 className="font-medium mb-2">Calculation Breakdown:</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Basic Salary:</span>
                        <span>₹{formData.basicSalary.toFixed(2)}</span>
                      </div>
                      {formData.selectedAllowances.map((allowance, index) => {
                        let baseAmount = formData.basicSalary;
                        if (allowance.isBonus && allowance.bonusBasedOn === "Gross") {
                          baseAmount = formData.grossSalary;
                        }

                        const allowanceAmount = allowance.type === "Percentage"
                          ? (baseAmount * allowance.value) / 100
                          : allowance.value;

                        return (
                          <div key={index} className="flex justify-between">
                            <span>+ {allowance.name}:</span>
                            <span>₹{allowanceAmount.toFixed(2)}</span>
                          </div>
                        );
                      })}
                      <div className="flex justify-between border-t pt-1 font-medium">
                        <span>Total (Basic + Allowances):</span>
                        <span>₹{expectedGrossFromBasicPlusAllowances.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Gross Salary:</span>
                        <span>₹{formData.grossSalary.toFixed(2)}</span>
                      </div>
                      {!grossMatchesDerived && (
                        <div className="text-red-600 text-xs mt-1">
                          ⚠️ Gross Salary must equal Basic + Selected Allowances
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      Selected: {formData.selectedAllowances.length} allowance(s)
                    </p>
                    <p className="text-sm">
                      Basic + Selected Allowances:{" "}
                      <span className="font-semibold">₹{expectedGrossFromBasicPlusAllowances.toFixed(2)}</span>
                      {!grossMatchesDerived && (
                        <span className="text-red-600 ml-2">← doesn't match Gross</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Deduction Selection */}
              <div className="space-y-4">
                <div className="flex items-center gap-1">
                  <h3 className="text-lg font-semibold">Deduction Selection</h3>
                  <span className="relative group">
                    <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
                      {`Part of Deduction from Gross Salary`}
                    </span>
                  </span>
                </div>
                <div className="border rounded-lg p-4 bg-gray-50">
                  <p className="text-sm text-gray-600 mb-4">Select deductions for this pay grade:</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {deductionList.map((deduction) => {
                      const isSelected = formData.selectedDeductions.some((d) => d.id === deduction.id);
                      return (
                        <div key={deduction.id} className="flex items-center space-x-3 p-2 hover:bg-gray-100 rounded">
                          <input
                            type="checkbox"
                            id={`deduction-${deduction.id}`}
                            checked={isSelected}
                            onChange={() => handleDeductionToggle(deduction)}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <Label htmlFor={`deduction-${deduction.id}`} className="font-medium cursor-pointer">
                              {deduction.name}
                            </Label>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <span>
                                {deduction.type === "Percentage"
                                  ? `${deduction.value}% of Gross`
                                  : `₹${deduction.value}`}
                              </span>
                              <Badge variant="outline" className="text-xs">{deduction.type}</Badge>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-3 border-t flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      Selected: {formData.selectedDeductions.length} deduction(s)
                    </p>
                    <div className="text-sm space-x-4">
                      <span>
                        Total Deductions: <span className="font-semibold">₹{deductionTotal.toFixed(2)}</span>
                        {deductionTotal <= 0 && <span className="text-red-600 ml-2">← must be &gt; 0</span>}
                      </span>
                      <span>
                        Net Payable: <span className="font-semibold">₹{netPayable.toFixed(2)}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="">
                  {editingPayGrade ? "Update Paygrade" : "Add Paygrade"}
                </Button>
              </div>
            </form>
      </FormDrawer>

      {!isDialogOpen && (<>
      {/* Search */}
      <Card>
        <CardContent>
          <div className="flex items-center gap-3 w-full">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowBranchFilterModal(true)}
              className="flex-shrink-0"
              title="Filter by Branch"
            >
              <Filter className="w-4 h-4 mr-1" />
              Filter
              {selectedFilterBranchIds.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedFilterBranchIds.length}
                </Badge>
              )}
            </Button>

            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search paygrade setups..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>

            <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
              {filteredPayGrades.length} pay grades
            </Badge>
          </div>
        </CardContent>
      </Card>


      {showBranchFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl border">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <Filter className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    Filter Monthly Pay Grades by Branch
                  </h3>
                  <p className="text-xs text-gray-500">
                    Select one or multiple branches
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowBranchFilterModal(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">
                  {selectedFilterBranchIds.length} selected
                </Badge>

                <div className="flex gap-2">
                  {user?.role !== "BRANCH_ADMIN" && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={selectAllFilterBranches}
                        disabled={branchFilterLoading || branchFilterList.length === 0}
                      >
                        Select All
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearFilterBranches}
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Clear
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {branchFilterList.length === 0 ? (
                  <p className="text-sm text-gray-500 col-span-full py-8 text-center">
                    {branchFilterLoading ? "Loading branches..." : "No branches found"}
                  </p>
                ) : (
                  branchFilterList.map((branch: any) => (
                    <label
                      key={branch.id}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedFilterBranchIds.includes(String(branch.id))}
                        disabled={user?.role === "BRANCH_ADMIN"}
                        onChange={() => toggleFilterBranch(String(branch.id))}
                      />
                      <span className="truncate">{branch.branchName}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t px-5 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowBranchFilterModal(false)}
              >
                Cancel
              </Button>

              <Button
                type="button"
                onClick={() => setShowBranchFilterModal(false)}
              >
                Apply Filter
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Table */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="mdi:cash-multiple" className="w-5 h-5" />
            Paygrade Setup List
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 w-full">
          <div className="overflow-x-auto w-full">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Branch Name</TableHead>
                  <TableHead className="w-[150px]">Pay Grade Name</TableHead>
                  <TableHead className="w-[100px]">Gross</TableHead>
                  <TableHead className="w-[100px]">Basic</TableHead>
                  <TableHead className="w-[100px]">Allowances</TableHead>
                  <TableHead className="w-[100px]">Deductions</TableHead>
                  <TableHead className="w-[100px]">Created</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listLoading ? (
                  <TableBodySkeleton cols={8} />
                ) : filteredPayGrades.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Icon icon="mdi:cash-multiple" className="w-12 h-12 text-gray-300" />
                        <p>No paygrade setups found</p>
                        <p className="text-sm">Try adjusting your search criteria</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayGrades.map((pg) => (
                    <TableRow key={pg.id}>
                      <TableCell className="whitespace-nowrap">{pg.branchName}</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{pg.monthlyPayGradeName}</TableCell>
                      <TableCell className="whitespace-nowrap text-center">₹{pg.grossSalary}</TableCell>
                      <TableCell className="whitespace-nowrap text-center">₹{pg.basicSalary}</TableCell>
                      <TableCell className="whitespace-nowrap text-center">
                        <Badge variant="secondary">{pg.selectedAllowances.length} allowances</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center">
                        <Badge variant="secondary">{pg.selectedDeductions.length} deductions</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{pg.createdAt}</TableCell>
                      {canManage && (
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(pg)}
                              className="h-7 w-7 p-0"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(pg.id)}
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
      </>)}
    </div>
  );
}

/* ---------- tiny debounce helper ---------- */
function debounce<T extends (...args: any[]) => any>(fn: T, ms = 300) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}