"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Icon } from "@iconify/react";
import { Plus, Search, Edit, Trash2, Eye, ArrowLeft, X, Save, ChevronDown, FileText, Shield } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { FormDrawer } from "../components/ui/form-drawer";
import { TimezoneSelect } from "../components/ui/timezone-select";
import { LocationFields } from "../components/ui/location-fields";
import { SearchSuggestInput } from "../components/SearchSuggestInput";
import { fetchCurrencies } from "../utils/geoApi";
import { toast } from "sonner";
import { getSidebarContext } from "../utils/sidebarContext";
import { PdfUploadField } from "../components/PdfUploadField";

// ---------------------------
// Types aligned to backend
// ---------------------------
type ID = number;

interface BankDetailRead {
  id: ID;
  bankName?: string | null;
  bankBranchName?: string | null;
  accountNo?: string | null;
  ifscCode?: string | null;
}

interface BankDetailForm {
  id?: ID;            // present for existing rows
  _localId: string;   // for React key handling
  bankName: string;
  branchName: string; // UI label maps to bankBranchName
  accountNo: string;
  ifscCode: string;
}

interface BranchRead {
  id: ID;
  serviceProviderID?: ID | null;
  companyID?: ID | null;
  branchName?: string | null;
  branchType?: string | null;
  address?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  pincode?: string | null;
  timeZone?: string | null;
  currency?: string | null;
  pfNo?: string | null;
  tanNo?: string | null;
  esiNo?: string | null;
  linNo?: string | null;
  gstNo?: string | null;
  gstCertUrl?: string | null;
  msmeNo?: string | null;
  msmeCertUrl?: string | null;
  shopRegNo?: string | null;
  shopRegCertHistory?: { certNo: string; effectFrom: string; pdfUrl?: string; _localId: string }[] | null;
  contactNo?: string | null;
  emailAdd?: string | null;
  companyLogoUrl?: string | null;
  SignatureUrl?: string | null;
  financialYearStart?: string | null;
  createdAt?: string | null;
  bankDetails?: BankDetailRead[];
}

interface ServiceProvider {
  id: ID;
  companyName: string; // using companyName as you asked
}

interface Company {
  id: ID;
  companyName: string;
}

// ---------------------------
// Config & helpers
// ---------------------------
const API = {
  branches: "/backend/branches",
  serviceProviders: "/backend/service-provider",
  companies: "/backend/company",
};

const MIN_CHARS = 0;
const DEBOUNCE_MS = 250;

const uid = () => Math.random().toString(36).slice(2, 10);

async function fetchJSONSafe<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const raw = await res.json();
  return (raw?.data ?? raw) as T; // handle { data: [...] } or [...]
}

// ---------------------------
// Component
// ---------------------------
export function BranchManagement() {
  const router = useRouter();
  // Data
  const [branches, setBranches] = useState<BranchRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchRead | null>(null);
  const [viewBranch, setViewBranch] = useState<BranchRead | null>(null);

  // Suggestions state/refs
  const spRef = useRef<HTMLDivElement>(null);
  const coRef = useRef<HTMLDivElement>(null);

  const [spList, setSpList] = useState<ServiceProvider[]>([]);
  const [coList, setCoList] = useState<Company[]>([]);
  const [spLoading, setSpLoading] = useState(false);
  const [coLoading, setCoLoading] = useState(false);
  const spAbortRef = useRef<AbortController | null>(null);
  const coAbortRef = useRef<AbortController | null>(null);
  const spTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const user = useCurrentUser();
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN";
  const canCreate = user?.role === "SUPERADMIN" || user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN";
  const isEmployee = user?.role === "EMPLOYEE";

  // Add this with your other state declarations
  const [currentUserMapping, setCurrentUserMapping] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    serviceProviderID: null as ID | null,
    companyID: null as ID | null,

    branchName: "",
    branchType: "",
    address: "",
    country: "",
    state: "",
    city: "",
    pincode: "",
    timeZone: "",
    currency: "",
    pfNo: "",
    tanNo: "",
    esiNo: "",
    linNo: "",
    gstNo: "",
    gstCertUrl: "",
    msmeNo: "",
    msmeCertUrl: "",
    shopRegNo: "",
    shopRegCertHistory: [] as { certNo: string; effectFrom: string; pdfUrl?: string; _localId: string }[],
    contactNo: "",
    emailAdd: "",
    companyLogoUrl: "",
    SignatureUrl: "",
    financialYearStart: "",

    spAutocomplete: "",
    coAutocomplete: "",

    bankDetailsForm: [] as BankDetailForm[],
  });

  // Track original bank IDs on edit to compute deletions
  const [originalBankIds, setOriginalBankIds] = useState<ID[]>([]);

  const [stagingShopReg, setStagingShopReg] = useState({ certNo: "", effectFrom: new Date().toISOString().slice(0, 10), pdfUrl: "" as string });

  // Handle PT Compliance navigation
  const handlePTCompliance = () => {
    router.push('/pt-compliance');
  };

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const all = await fetchJSONSafe<BranchRead[]>(API.branches);

      // 🟢 SUPERADMIN → filter by sidebar context
      if (user?.role === "SUPERADMIN") {
        const ctx = getSidebarContext();
        if (ctx?.companyID) {
          setBranches(all.filter((r: any) => r.companyID === ctx.companyID));
        } else {
          setBranches(all);
        }
        return;
      }

      // 🟡 Non-SUPERADMIN → Get user mapping first
      const usersRes = await fetch("/backend/users");
      const users = await usersRes.json();
      const currentUser = users.find((u: any) => u.username === user?.username);

      if (currentUser) {
        // Store the user mapping for form auto-fill
        setCurrentUserMapping(currentUser);

        if (user?.role === "SERVICE_PROVIDER") {
          // Service provider sees branches for selected company from sidebar
          const ctx = getSidebarContext();
          if (ctx?.companyID) {
            setBranches(all.filter((b: any) => b.companyID === ctx.companyID));
          } else {
            setBranches(all.filter((b: any) => b.serviceProviderID === currentUser.serviceProviderID));
          }
        } else if (user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN") {
          // Company admin / Admin sees all branches in their company
          let filtered: any[];
          if (currentUser.companyID) {
            filtered = all.filter(
              (b: any) => b.companyID === currentUser.companyID
            );
          } else if (currentUser.serviceProviderID) {
            filtered = all.filter(
              (b: any) => b.serviceProviderID === currentUser.serviceProviderID
            );
          } else {
            filtered = [];
          }
          setBranches(filtered);
        } else if (user?.role === "BRANCH_ADMIN") {
          // Branch admin sees only their branch
          const filtered = all.filter(
            (b: any) =>
              b.companyID === currentUser.companyID &&
              b.id === currentUser.branchesID
          );
          setBranches(filtered);
        } else if (user?.role === "EMPLOYEE") {
          // For EMPLOYEE, still use credentials but store user mapping
          const credsRes = await fetch("/backend/manage-emp/credentials/all");
          const creds = await credsRes.json();
          const emp = creds.find((c: any) => c.username === user?.username);

          if (emp) {
            const filtered = all.filter(
              (b: any) =>
                b.companyID === emp.companyID &&
                b.id === emp.branchesID
            );
            setBranches(filtered);
          } else {
            console.warn("Employee mapping not found in credentials.");
            setBranches([]);
          }
        }
      } else {
        console.warn("User not found in /users mapping.");
        setBranches([]);
      }
    } catch (e: any) {
      console.error("Failed to load branches:", e);
      setBranches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchBranches();
  }, [user]);

  useEffect(() => {
    const handler = () => { if (user) fetchBranches(); };
    window.addEventListener("sidebar-context-changed", handler);
    return () => window.removeEventListener("sidebar-context-changed", handler);
  }, [user]);

  // ---------------------------
  // Debounced suggestions
  // ---------------------------
  const runFetchServiceProviders = (query: string) => {
    if (spTimerRef.current) clearTimeout(spTimerRef.current);
    spTimerRef.current = setTimeout(async () => {
      if (query.length < MIN_CHARS) {
        setSpList([]);
        return;
      }
      if (spAbortRef.current) spAbortRef.current.abort();
      const ctrl = new AbortController();
      spAbortRef.current = ctrl;
      setSpLoading(true);
      try {
        const all = await fetchJSONSafe<ServiceProvider[]>(API.serviceProviders, ctrl.signal);
        const filtered = (all || []).filter(sp =>
          (sp.companyName ?? "").toLowerCase().includes(query.toLowerCase())
        );
        setSpList(filtered.slice(0, 20));
      } catch (e) {
        if ((e as any).name !== "AbortError") console.error("SP fetch error:", e);
      } finally {
        setSpLoading(false);
      }
    }, DEBOUNCE_MS);
  };

  const runFetchCompanies = (query: string) => {
    if (coTimerRef.current) clearTimeout(coTimerRef.current);
    coTimerRef.current = setTimeout(async () => {
      if (query.length < MIN_CHARS) {
        setCoList([]);
        return;
      }
      if (coAbortRef.current) coAbortRef.current.abort();
      const ctrl = new AbortController();
      coAbortRef.current = ctrl;
      setCoLoading(true);
      try {
        const all = await fetchJSONSafe<Company[]>(API.companies, ctrl.signal);
        const filtered = (all || []).filter(c =>
          (c.companyName ?? "").toLowerCase().includes(query.toLowerCase())
        );
        setCoList(filtered.slice(0, 20));
      } catch (e) {
        if ((e as any).name !== "AbortError") console.error("Company fetch error:", e);
      } finally {
        setCoLoading(false);
      }
    }, DEBOUNCE_MS);
  };

  // Close suggestion popovers on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (spRef.current && !spRef.current.contains(e.target as any)) setSpList([]);
      if (coRef.current && !coRef.current.contains(e.target as any)) setCoList([]);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Cleanup timers/aborts on unmount
  useEffect(() => {
    return () => {
      if (spTimerRef.current) clearTimeout(spTimerRef.current);
      if (coTimerRef.current) clearTimeout(coTimerRef.current);
      spAbortRef.current?.abort();
      coAbortRef.current?.abort();
    };
  }, []);

  // ---------------------------
  // Form helpers
  // ---------------------------
  const resetForm = () => {
    const baseFormData = {
      serviceProviderID: null as ID | null,
      companyID: null as ID | null,
      branchName: "",
      branchType: "",
      address: "",
      country: "",
      state: "",
      city: "",
      pincode: "",
      timeZone: "",
      currency: "",
      pfNo: "",
      tanNo: "",
      esiNo: "",
      linNo: "",
      gstNo: "",
      gstCertUrl: "",
      msmeNo: "",
      msmeCertUrl: "",
      shopRegNo: "",
      shopRegCertHistory: [],
      contactNo: "",
      emailAdd: "",
      companyLogoUrl: "",
      SignatureUrl: "",
      financialYearStart: "",
      spAutocomplete: "",
      coAutocomplete: "",
      bankDetailsForm: [],
    };

    // Auto-set Service Provider and Company for MANAGER/COMPANY_ADMIN/ADMIN (no UI display)
    if ((user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN") && currentUserMapping) {
      baseFormData.serviceProviderID = currentUserMapping.serviceProviderID;
      baseFormData.companyID = currentUserMapping.companyID;
    } else if (user?.role === "SUPERADMIN") {
      const ctx = getSidebarContext();
      if (ctx) {
        baseFormData.serviceProviderID = ctx.serviceProviderID;
        baseFormData.companyID = ctx.companyID;
        baseFormData.spAutocomplete = ctx.serviceProviderName;
        baseFormData.coAutocomplete = ctx.companyName;
      }
    }

    setFormData(baseFormData);
    setOriginalBankIds([]);
    setEditingBranch(null);
    setSpList([]);
    setCoList([]);
    setError(null);
  };

  const addBankDetail = () => {
    setFormData((p) => ({
      ...p,
      bankDetailsForm: [
        ...p.bankDetailsForm,
        {
          _localId: uid(),
          bankName: "",
          branchName: "",
          accountNo: "",
          ifscCode: "",
        },
      ],
    }));
  };

  const removeBankDetail = (localId: string) => {
    setFormData((p) => ({
      ...p,
      bankDetailsForm: p.bankDetailsForm.filter((x) => x._localId !== localId),
    }));
  };

  const updateBankDetail = (localId: string, key: keyof BankDetailForm, val: string) => {
    setFormData((p) => ({
      ...p,
      bankDetailsForm: p.bankDetailsForm.map((x) =>
        x._localId === localId ? { ...x, [key]: val } : x
      ),
    }));
  };

  // ---------------------------
  // CRUD submit
  // ---------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const validationErrors: string[] = [];
    if (!formData.branchName?.trim()) validationErrors.push("Branch Name is required");
    if (validationErrors.length > 0) {
      validationErrors.forEach(msg => toast.error(msg));
      return;
    }

    setSaving(true);
    setError(null);

    // For MANAGER/COMPANY_ADMIN, ensure serviceProviderID and companyID are set from user mapping
    let finalServiceProviderID = formData.serviceProviderID;
    let finalCompanyID = formData.companyID;

    if ((user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN") && currentUserMapping) {
      finalServiceProviderID = currentUserMapping.serviceProviderID;
      finalCompanyID = currentUserMapping.companyID;
    }

    // map UI bankDetails to API shape
    const apiBankDetails = formData.bankDetailsForm.map((b) => ({
      id: b.id, // present for existing rows
      bankName: b.bankName || undefined,
      bankBranchName: b.branchName || undefined,
      accountNo: b.accountNo || undefined,
      ifscCode: b.ifscCode || undefined,
    }));

    // compute deletions (only in edit mode)
    const remainingIds = new Set(apiBankDetails.filter(x => x.id != null).map(x => x.id as number));
    const idsToDelete = editingBranch
      ? originalBankIds.filter(id => !remainingIds.has(id))
      : [];

    const payload: any = {
      serviceProviderID: finalServiceProviderID ?? undefined, // Use the final IDs
      companyID: finalCompanyID ?? undefined, // Use the final IDs
      branchName: formData.branchName || undefined,
      branchType: formData.branchType || undefined,
      address: formData.address || undefined,
      country: formData.country || undefined,
      state: formData.state || undefined,
      city: formData.city || undefined,
      pincode: formData.pincode || undefined,
      timeZone: formData.timeZone || undefined,
      currency: formData.currency || undefined,
      pfNo: formData.pfNo || undefined,
      tanNo: formData.tanNo || undefined,
      esiNo: formData.esiNo || undefined,
      linNo: formData.linNo || undefined,
      gstNo: formData.gstNo || undefined,
      gstCertUrl: formData.gstCertUrl || undefined,
      msmeNo: formData.msmeNo || undefined,
      msmeCertUrl: formData.msmeCertUrl || undefined,
      shopRegNo: formData.shopRegNo || undefined,
      shopRegCertHistory: formData.shopRegCertHistory && formData.shopRegCertHistory.length > 0 ? formData.shopRegCertHistory : undefined,
      contactNo: formData.contactNo || undefined,
      emailAdd: formData.emailAdd || undefined,
      companyLogoUrl: formData.companyLogoUrl || undefined,
      SignatureUrl: formData.SignatureUrl || undefined,
      financialYearStart: formData.financialYearStart || undefined,
      bankDetails: apiBankDetails,
      ...(idsToDelete.length ? { idsToDelete } : {}),
    };

    try {
      if (editingBranch) {
        const res = await fetch(`${API.branches}/${editingBranch.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const res = await fetch(API.branches, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
      }

      await fetchBranches();
      resetForm();
      setIsAddingNew(false);
      setEditingBranch(null);
      toast.success("Branch saved successfully");
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (b: BranchRead) => {
    setEditingBranch(b);
    setIsAddingNew(true);
    setIsViewing(false);

    const bankDetailsForm: BankDetailForm[] = (b.bankDetails ?? []).map((bd) => ({
      id: bd.id,
      _localId: uid(),
      bankName: bd.bankName ?? "",
      branchName: bd.bankBranchName ?? "",
      accountNo: bd.accountNo ?? "",
      ifscCode: bd.ifscCode ?? "",
    }));

    // For MANAGER, use their mapped IDs instead of the branch's IDs
    let finalServiceProviderID = b.serviceProviderID ?? null;
    let finalCompanyID = b.companyID ?? null;
    let spName = "";
    let coName = "";

    if ((user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN") && currentUserMapping) {
      // Use user's mapped IDs
      finalServiceProviderID = currentUserMapping.serviceProviderID;
      finalCompanyID = currentUserMapping.companyID;
      spName = currentUserMapping.serviceProvider?.companyName ?? "";
      coName = currentUserMapping.company?.companyName ?? "";
    } else {
      // For SUPERADMIN, fetch the names as before
      if (b.serviceProviderID) {
        try {
          const sp = await fetchJSONSafe<ServiceProvider>(`${API.serviceProviders}/${b.serviceProviderID}`);
          spName = sp.companyName ?? "";
        } catch (e) {
          console.warn("Could not fetch service provider name:", e);
        }
      }

      if (b.companyID) {
        try {
          const co = await fetchJSONSafe<Company>(`${API.companies}/${b.companyID}`);
          coName = co.companyName ?? "";
        } catch (e) {
          console.warn("Could not fetch company name:", e);
        }
      }
    }

    setFormData({
      serviceProviderID: finalServiceProviderID,
      companyID: finalCompanyID,

      branchName: b.branchName ?? "",
      branchType: b.branchType ?? "",
      address: b.address ?? "",
      country: b.country ?? "",
      state: b.state ?? "",
      city: b.city ?? "",
      pincode: b.pincode ?? "",
      timeZone: b.timeZone ?? "",
      currency: b.currency ?? "",
      pfNo: b.pfNo ?? "",
      tanNo: b.tanNo ?? "",
      esiNo: b.esiNo ?? "",
      linNo: b.linNo ?? "",
      gstNo: b.gstNo ?? "",
      gstCertUrl: (b as any).gstCertUrl ?? "",
      msmeNo: (b as any).msmeNo ?? "",
      msmeCertUrl: (b as any).msmeCertUrl ?? "",
      shopRegNo: b.shopRegNo ?? "",
      shopRegCertHistory: Array.isArray((b as any).shopRegCertHistory) ? (b as any).shopRegCertHistory : [],
      contactNo: b.contactNo ?? "",
      emailAdd: b.emailAdd ?? "",
      companyLogoUrl: b.companyLogoUrl ?? "",
      SignatureUrl: b.SignatureUrl ?? "",
      financialYearStart: b.financialYearStart ?? "",

      spAutocomplete: spName,
      coAutocomplete: coName,

      bankDetailsForm,
    });

    setOriginalBankIds(bankDetailsForm.filter(x => x.id != null).map(x => x.id!));

    // Clear suggestion lists to prevent highlighting/focus
    setTimeout(() => {
      setSpList([]);
      setCoList([]);
    }, 0);
  };

  const handleView = (b: BranchRead) => {
    setViewBranch(b);
    setIsViewing(true);
    setIsAddingNew(false);
  };

  const handleDelete = async (id: ID) => {
    if (!confirm("Delete this branch?")) return;
    try {
      const res = await fetch(`${API.branches}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      await fetchBranches();
      toast.success("Branch deleted successfully");
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  };

  const handleCancel = () => {
    resetForm();
    setIsAddingNew(false);
    setIsViewing(false);
    setViewBranch(null);
  };


  // ---------------------------
  // Search
  // ---------------------------
  const filteredBranches = useMemo(() => {
    const t = searchTerm.trim().toLowerCase();
    if (!t) return branches;
    return branches.filter((b) =>
      [
        b.branchName,
        b.branchType,
        b.address,
        b.country,
        b.state,
        b.emailAdd,
        b.gstNo,
      ]
        .filter(Boolean)
        .map((x) => (x ?? "").toLowerCase())
        .some((f) => f.includes(t))
    );
  }, [branches, searchTerm]);

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto px-4">
     

      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <p className="text-gray-600 mt-1 text-sm">Manage branch records</p>
        </div>

        <div className="flex items-center gap-3">
          {!isAddingNew && !isViewing && canCreate && (
            <Button
              onClick={() => {
                resetForm();
                setIsAddingNew(true);
              }}
              className="text-sm px-3 py-2"
            >
              <Plus className="w-4 h-4 mr-1" /> Add Branch
            </Button>
          )}
          {(isAddingNew || isViewing) && (
            <Button
              variant="outline"
              onClick={handleCancel}
              className="text-sm"
            >
              <X className="w-4 h-4 mr-1" /> BACK
            </Button>
          )}
        </div>
      </div>

      {/* Add/Edit Form - Drawer */}
      <FormDrawer
        open={isAddingNew}
        onOpenChange={function handleDrawerChange(v: boolean) { if (!v) handleCancel(); }}
        title={editingBranch ? "Edit Branch" : "Add New Branch"}
      >
        <div>
          <div>
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Service Provider - auto-filled from sidebar */}
              {false && (
                <div ref={spRef} className="space-y-2 relative">
                  <Label>Service Provider *</Label>
                  <Input
                    value={formData.spAutocomplete}
                    onChange={(e) => {
                      if (editingBranch) return;
                      const val = e.target.value;
                      setFormData((p) => ({ ...p, spAutocomplete: val, serviceProviderID: null }));
                      runFetchServiceProviders(val);
                    }}
                    onFocus={(e) => {
                      if (editingBranch) return;
                      const val = e.target.value;
                      if (val.length >= MIN_CHARS) runFetchServiceProviders(val);
                    }}
                    placeholder="Start typing service provider..."
                    autoComplete="off"
                    required
                    readOnly={editingBranch ? true : false}
                    className={editingBranch ? "bg-gray-50 cursor-not-allowed" : ""}
                  />
                  {spList.length > 0 && !editingBranch && (
                    <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                      {spLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                      {spList.map((sp) => (
                        <div
                          key={sp.id}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setFormData((p) => ({
                              ...p,
                              serviceProviderID: sp.id,
                              spAutocomplete: sp.companyName,
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
              )}

              {/* Company - auto-filled from sidebar */}
              {false && (
                <div ref={coRef} className="space-y-2 relative">
                  <Label>Company *</Label>
                  <Input
                    value={formData.coAutocomplete}
                    onChange={(e) => {
                      if (editingBranch) return;
                      const val = e.target.value;
                      setFormData((p) => ({ ...p, coAutocomplete: val, companyID: null }));
                      runFetchCompanies(val);
                    }}
                    onFocus={(e) => {
                      if (editingBranch) return;
                      const val = e.target.value;
                      if (val.length >= MIN_CHARS) runFetchCompanies(val);
                    }}
                    placeholder="Start typing company..."
                    autoComplete="off"
                    required
                    readOnly={editingBranch ? true : false}
                    className={editingBranch ? "bg-gray-50 cursor-not-allowed" : ""}
                  />
                  {coList.length > 0 && !editingBranch && (
                    <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                      {coLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                      {coList.map((co) => (
                        <div
                          key={co.id}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setFormData((p) => ({
                              ...p,
                              companyID: co.id,
                              coAutocomplete: co.companyName,
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
              )}

              {/* Core fields */}
              <div className="space-y-2">
                <Label>Branch Name</Label>
                <Input
                  value={formData.branchName}
                  onChange={(e) => setFormData((p) => ({ ...p, branchName: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Branch Type</Label>
                <div className="flex flex-wrap gap-3">
                  {["office", "shop", "factory"].map((type) => {
                    const selected = (formData.branchType || "").split(",").map(s => s.trim()).filter(Boolean);
                    const isChecked = selected.includes(type);
                    return (
                      <label key={type} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const current = (formData.branchType || "").split(",").map(s => s.trim()).filter(Boolean);
                            const updated = e.target.checked
                              ? [...current, type]
                              : current.filter(v => v !== type);
                            setFormData((p) => ({ ...p, branchType: updated.join(", ") }));
                          }}
                          className="w-4 h-4"
                        />
                        <span className="capitalize">{type}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Branch Address</Label>
                <Textarea
                  value={formData.address}
                  onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                  rows={3}
                />
              </div>

              <LocationFields
                values={{
                  city: formData.city,
                  state: formData.state,
                  pincode: formData.pincode,
                  country: formData.country,
                  currency: formData.currency,
                }}
                onChange={(patch) => setFormData((p) => ({ ...p, ...patch }))}
                showCurrency={false}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Time Zone</Label>
                  <TimezoneSelect
                    value={formData.timeZone || ""}
                    onChange={(value) => setFormData((p) => ({ ...p, timeZone: value }))}
                  />
                </div>
                <SearchSuggestInput
                  label="Currency"
                  placeholder="Type currency code…"
                  value={formData.currency}
                  onChange={(v) => setFormData((p) => ({ ...p, currency: v }))}
                  onSelect={({ display }) => setFormData((p) => ({ ...p, currency: display }))}
                  fetchData={fetchCurrencies}
                  displayField="code"
                  valueField="code"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>PF No</Label><Input value={formData.pfNo} onChange={(e) => setFormData((p) => ({ ...p, pfNo: e.target.value }))} /></div>
                <div className="space-y-2"><Label>TAN No</Label><Input value={formData.tanNo} onChange={(e) => setFormData((p) => ({ ...p, tanNo: e.target.value }))} /></div>
                <div className="space-y-2"><Label>ESI No</Label><Input value={formData.esiNo} onChange={(e) => setFormData((p) => ({ ...p, esiNo: e.target.value }))} /></div>
                <div className="space-y-2"><Label>LIN No</Label><Input value={formData.linNo} onChange={(e) => setFormData((p) => ({ ...p, linNo: e.target.value }))} /></div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>GST No</Label>
                  <Input value={formData.gstNo} onChange={(e) => setFormData((p) => ({ ...p, gstNo: e.target.value }))} />
                  <PdfUploadField label="GST certificate (PDF)" value={formData.gstCertUrl} onChange={(url) => setFormData((p) => ({ ...p, gstCertUrl: url ?? "" }))} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>MSME certification no</Label>
                  <Input value={formData.msmeNo} onChange={(e) => setFormData((p) => ({ ...p, msmeNo: e.target.value }))} />
                  <PdfUploadField label="MSME certificate (PDF)" value={formData.msmeCertUrl} onChange={(url) => setFormData((p) => ({ ...p, msmeCertUrl: url ?? "" }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Shop Registration Certificate</Label>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-[140px]">
                    <Input
                      placeholder="Certificate No"
                      value={stagingShopReg.certNo}
                      onChange={(e) => setStagingShopReg((p) => ({ ...p, certNo: e.target.value }))}
                    />
                  </div>
                  <div className="w-40">
                    <Input
                      type="date"
                      value={stagingShopReg.effectFrom}
                      onChange={(e) => setStagingShopReg((p) => ({ ...p, effectFrom: e.target.value }))}
                    />
                  </div>
                  <div className="min-w-[200px]">
                    <PdfUploadField
                      label="Certificate PDF"
                      value={stagingShopReg.pdfUrl || null}
                      onChange={(url) => setStagingShopReg((p) => ({ ...p, pdfUrl: url ?? "" }))}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!stagingShopReg.certNo.trim()}
                    onClick={() => {
                      const entry = {
                        certNo: stagingShopReg.certNo.trim(),
                        effectFrom: stagingShopReg.effectFrom,
                        pdfUrl: stagingShopReg.pdfUrl || undefined,
                        _localId: Math.random().toString(36).slice(2, 10),
                      };
                      setFormData((p) => ({
                        ...p,
                        shopRegCertHistory: [...(p.shopRegCertHistory || []), entry],
                        shopRegNo: entry.certNo,
                      }));
                      setStagingShopReg({ certNo: "", effectFrom: new Date().toISOString().slice(0, 10), pdfUrl: "" });
                    }}
                  >
                    Add
                  </Button>
                </div>
                {(formData.shopRegCertHistory || []).length > 0 && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden mt-2">
                    <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide flex">
                      <span className="flex-1">Certificate No</span>
                      <span className="w-32 text-center">Effect Date</span>
                      <span className="w-10"></span>
                    </div>
                    {(formData.shopRegCertHistory || []).map((entry, i) => (
                      <div
                        key={entry._localId}
                        className={`flex items-center px-3 py-2 text-sm ${i === (formData.shopRegCertHistory || []).length - 1 ? "bg-blue-50 font-medium" : "bg-white"} ${i > 0 ? "border-t border-gray-100" : ""}`}
                      >
                        <span className="flex-1">{entry.certNo}</span>
                        <span className="w-32 text-center text-gray-500">{entry.effectFrom || "—"}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setFormData((p) => {
                              const updated = (p.shopRegCertHistory || []).filter((x) => x._localId !== entry._localId);
                              return { ...p, shopRegCertHistory: updated, shopRegNo: updated.length > 0 ? updated[updated.length - 1].certNo : "" };
                            });
                          }}
                          className="h-6 w-6 p-0 text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contact Number</Label>
                  <Input value={formData.contactNo} onChange={(e) => setFormData((p) => ({ ...p, contactNo: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input type="email" value={formData.emailAdd} onChange={(e) => setFormData((p) => ({ ...p, emailAdd: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Logo & Signature Upload */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Company Logo</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                    />
                    {logoFile && <p className="text-sm text-gray-500">{logoFile.name}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label>Signature Upload</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setSignatureFile(e.target.files?.[0] || null)}
                    />
                    {signatureFile && <p className="text-sm text-gray-500">{signatureFile.name}</p>}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Financial Year Start</Label>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={formData.financialYearStart || ""}
                  onChange={(e) => setFormData((p) => ({ ...p, financialYearStart: e.target.value }))}
                >
                  <option value="">-- Select Start Date --</option>
                  <option value="1st Jan">1st Jan</option>
                  <option value="1st April">1st April</option>
                </select>
              </div>

              {/* Bank Details repeater - hidden for ADMIN and COMPANY_ADMIN */}
              {!(user?.role === "ADMIN" || user?.role === "COMPANY_ADMIN") && <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Bank Details</h3>
                  <Button variant="outline" size="sm" type="button" onClick={addBankDetail}>
                    <Plus className="w-4 h-4 mr-1" /> Add Bank Detail
                  </Button>
                </div>

                {formData.bankDetailsForm.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg">
                    <Icon icon="mdi:bank" className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p>No bank details added yet</p>
<p className="text-sm">
  Click &quot;Add Bank Detail&quot; to add bank information
</p>
                  </div>
                ) : (
                  formData.bankDetailsForm.map((bank) => (
                    <div key={bank._localId} className="border border-gray-200 rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">Bank Detail</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeBankDetail(bank._localId)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Icon icon="mdi:close" className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Bank Name</Label>
                          <Input
                            value={bank.bankName}
                            onChange={(e) => updateBankDetail(bank._localId, "bankName", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Branch Name</Label>
                          <Input
                            value={bank.branchName}
                            onChange={(e) => updateBankDetail(bank._localId, "branchName", e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Account No</Label>
                          <Input
                            value={bank.accountNo}
                            onChange={(e) => updateBankDetail(bank._localId, "accountNo", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>IFSC Code</Label>
                          <Input
                            value={bank.ifscCode}
                            onChange={(e) => updateBankDetail(bank._localId, "ifscCode", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>}

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button type="submit" className="" disabled={saving}>
                  <Save className="w-4 h-4 mr-1" />
                  {saving ? "Saving..." : editingBranch ? "Update Branch" : "Add Branch"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </FormDrawer>

      {/* View Details - Drawer */}
      <FormDrawer
        open={Boolean(isViewing && viewBranch)}
        onOpenChange={function handleViewClose(v: boolean) { if (!v) handleCancel(); }}
        title="Branch Details"
      >
        {viewBranch && (
        <div>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg"><strong>Name:</strong> {viewBranch.branchName}</div>
                <div className="p-3 bg-gray-50 rounded-lg"><strong>Type:</strong> {viewBranch.branchType}</div>
                <div className="p-3 bg-gray-50 rounded-lg"><strong>Address:</strong> {viewBranch.address}</div>
                <div className="p-3 bg-gray-50 rounded-lg"><strong>Country:</strong> {viewBranch.country}</div>
                <div className="p-3 bg-gray-50 rounded-lg"><strong>State:</strong> {viewBranch.state}</div>
                <div className="p-3 bg-gray-50 rounded-lg"><strong>City:</strong> {viewBranch.city}</div>
                <div className="p-3 bg-gray-50 rounded-lg"><strong>Pincode:</strong> {viewBranch.pincode}</div>
                <div className="p-3 bg-gray-50 rounded-lg"><strong>GST No:</strong> {viewBranch.gstNo}</div>
                <div className="p-3 bg-gray-50 rounded-lg"><strong>Contact:</strong> {viewBranch.contactNo}</div>
                <div className="p-3 bg-gray-50 rounded-lg"><strong>Email:</strong> {viewBranch.emailAdd}</div>
                <div className="p-3 bg-gray-50 rounded-lg"><strong>Currency:</strong> {viewBranch.currency}</div>
                <div className="p-3 bg-gray-50 rounded-lg"><strong>TimeZone:</strong> {viewBranch.timeZone}</div>
                <div className="p-3 bg-gray-50 rounded-lg"><strong>PF:</strong> {viewBranch.pfNo}</div>
                <div className="p-3 bg-gray-50 rounded-lg"><strong>TAN:</strong> {viewBranch.tanNo}</div>
                <div className="p-3 bg-gray-50 rounded-lg"><strong>ESI:</strong> {viewBranch.esiNo}</div>
                <div className="p-3 bg-gray-50 rounded-lg"><strong>LIN:</strong> {viewBranch.linNo}</div>
                <div className="p-3 bg-gray-50 rounded-lg"><strong>Shop Reg:</strong> {viewBranch.shopRegNo}
                  {(viewBranch as any).shopRegCertHistory && Array.isArray((viewBranch as any).shopRegCertHistory) && (viewBranch as any).shopRegCertHistory.length > 0 && (
                    <div className="mt-1 text-xs text-gray-500">
                      {(viewBranch as any).shopRegCertHistory.map((h: any, i: number) => (
                        <div key={i}>{h.certNo} — WEF {h.effectFrom || "—"}</div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-3 bg-gray-50 rounded-lg"><strong>FY Start:</strong> {viewBranch.financialYearStart}</div>
              </div>
              
              {viewBranch.bankDetails && viewBranch.bankDetails.length > 0 && (
                <div className="mt-4">
                  <p className="font-semibold mb-2">Bank Accounts:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {viewBranch.bankDetails.map((bd) => (
                      <div key={bd.id} className="border rounded-lg p-3 bg-gray-50">
                        <div><strong>{bd.bankName}</strong> — {bd.bankBranchName}</div>
                        <div className="text-sm">Acct: {bd.accountNo}</div>
                        <div className="text-sm">IFSC: {bd.ifscCode}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
        </div>
        )}
      </FormDrawer>

      {!isAddingNew && !isViewing && (<>
      {/* Search & Table */}
      <Card>
            <CardContent className="p-6 flex items-center space-x-4">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search branches..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
              <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
                {filteredBranches.length} branches
              </Badge>
            </CardContent>
          </Card>

          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon icon="mdi:office-building-multiple" className="w-5 h-5" /> Branch List
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 w-full overflow-x-auto">
              {loading ? (
                <div className="p-6 text-sm text-gray-500">Loading…</div>
              ) : (
                <Table className="w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Branch Name</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Pin</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBranches.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                          <div className="flex flex-col items-center gap-2">
                            <Icon icon="mdi:account-search" className="w-12 h-12 text-gray-300" />
                            <p>No branches found</p>
                            <p className="text-sm">Try adjusting your search criteria</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredBranches.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell>{b.branchName || "—"}</TableCell>
                          <TableCell>{b.city || "—"}</TableCell>
                          <TableCell>{b.pincode || "—"}</TableCell>
                          <TableCell>{b.state || "—"}</TableCell>
                          <TableCell>{b.country || "—"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* ✏️ Only SUPERADMIN and MANAGER can edit */}
                              {canManage && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(b)}
                                  className="h-7 w-7 p-0"
                                  title="Edit"
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                              )}

                              {/* 🗑️ Only SUPERADMIN can delete */}
                              {user?.role === "SUPERADMIN" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(b.id)}
                                  className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
      </>)}
    </div>
  );
}