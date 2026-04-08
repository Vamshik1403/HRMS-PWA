"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { FormDrawer } from "../components/ui/form-drawer";
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
import { Plus, Search, Edit, Trash2, Eye, IndianRupee } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { toast } from "sonner";


// ---------------------------
// Types aligned to backend
// ---------------------------
type ID = number;

interface ContractorRead {
  id: ID;
  serviceProviderID?: ID | null;
  companyID?: ID | null;

  contractorName?: string | null;
  contractorType?: string | null;
  address?: string | null;
  country?: string | null;
  state?: string | null;
  timeZone?: string | null;
  currency?: string | null;
  pfNo?: string | null;
  tanNo?: string | null;
  esiNo?: string | null;
  linNo?: string | null;
  gstNo?: string | null;
  shopRegNo?: string | null;
  financialYearStart?: string | null;
  contactNo?: string | null;
  emailAdd?: string | null;
  companyLogoUrl?: string | null;
  SignatureUrl?: string | null;
  createdAt?: string | null;

  // optional nested (if your backend includes them)
  serviceProvider?: { id: ID; companyName?: string | null } | null;
  company?: { id: ID; companyName?: string | null } | null;

  // fallback denormalized names (if your API returns them)
  serviceProviderName?: string | null;
  companyName?: string | null;
}

interface ServiceProvider {
  id: ID;
  companyName: string;
}
interface Company {
  id: ID;
  companyName: string;
  serviceProviderID?: ID; // Add this if your company model has serviceProviderID
}

interface ContractorRateCard {
  _localId: string;
  contractorName: string;
  departmentName: string;
  designation: string;
  workShiftName: string;
  perMinuteRate: string;
  perHourRate: string;
  perDayRate: string;
  perMonthRate: string;
}


// ---------------------------
// Config & helpers
// ---------------------------
const API = {
  contractors: "/backend/contractors",
  serviceProviders: "/backend/service-provider",
  companies: "/backend/company",
  upload: "/backend/files/upload",
};

const MIN_CHARS = 1;
const DEBOUNCE_MS = 250;

async function fetchJSONSafe<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const raw = await res.json();
  return (raw?.data ?? raw) as T;
}

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(API.upload, { method: "POST", body: fd });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  // return absolute URL if backend returns relative
  return data.url?.startsWith("http") ? data.url : `/backend${data.url}`;
}

// ---------------------------
// Component
// ---------------------------
export function ContractorManagement() {
  // Data
  const [rows, setRows] = useState<ContractorRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useCurrentUser();
  const canManage = user?.role === "SUPERADMIN" || user?.role === "MANAGER";
  const isEmployee = user?.role === "EMPLOYEE";
  // Add this with your other state declarations
  const [currentUserMapping, setCurrentUserMapping] = useState<any>(null);

  // Rate card state
  const [isRateCardOpen, setIsRateCardOpen] = useState(false);
  const [rateCardContractor, setRateCardContractor] = useState<ContractorRead | null>(null);
  const [rateCards, setRateCards] = useState<ContractorRateCard[]>([]);

  // Rate card dropdown data
  const [rcDepartments, setRcDepartments] = useState<{ id: number; departmentName: string }[]>([]);
  const [rcDesignations, setRcDesignations] = useState<{ id: number; designation: string; departmentID?: number }[]>([]);
  const [rcWorkShifts, setRcWorkShifts] = useState<{ id: number; workShiftName: string }[]>([]);

  const uid = () => Math.random().toString(36).slice(2, 10);

  const addRateCardRow = () => {
    setRateCards(prev => [...prev, { _localId: uid(), contractorName: rateCardContractor?.contractorName || "", departmentName: "", designation: "", workShiftName: "", perMinuteRate: "", perHourRate: "", perDayRate: "", perMonthRate: "" }]);
  };

  const updateRateCardRow = (localId: string, field: keyof Omit<ContractorRateCard, "_localId">, value: string) => {
    setRateCards(prev => prev.map(r => r._localId === localId ? { ...r, [field]: value } : r));
  };

  const removeRateCardRow = (localId: string) => {
    setRateCards(prev => prev.filter(r => r._localId !== localId));
  };

  const handleOpenRateCard = async (contractor: ContractorRead) => {
    setRateCardContractor(contractor);

    // Fetch departments, designations, and work shifts for dropdowns
    try {
      const [deptRes, desigRes, wsRes] = await Promise.all([
        fetchJSONSafe<any[]>("/backend/departments"),
        fetchJSONSafe<any[]>("/backend/designations"),
        fetchJSONSafe<any[]>("/backend/work-shift"),
      ]);
      // Filter by contractor's company context if available
      const cid = contractor.companyID;
      setRcDepartments(
        (deptRes || []).filter((d: any) => !cid || d.companyID === cid)
      );
      setRcDesignations(
        (desigRes || []).filter((d: any) => !cid || d.companyID === cid)
      );
      setRcWorkShifts(
        (wsRes || []).filter((w: any) => !cid || w.companyID === cid)
      );
    } catch {
      setRcDepartments([]);
      setRcDesignations([]);
      setRcWorkShifts([]);
    }

    try {
      const existing = await fetchJSONSafe<any[]>(`${API.contractors}/${contractor.id}/rate-cards`);
      if (existing && existing.length > 0) {
        setRateCards(existing.map((rc: any) => ({
          _localId: uid(),
          contractorName: rc.contractorName || contractor.contractorName || "",
          departmentName: rc.departmentName || "",
          designation: rc.designation || "",
          workShiftName: rc.workShiftName || "",
          perMinuteRate: rc.perMinuteRate?.toString() || "",
          perHourRate: rc.perHourRate?.toString() || "",
          perDayRate: rc.perDayRate?.toString() || "",
          perMonthRate: rc.perMonthRate?.toString() || "",
        })));
      } else {
        setRateCards([{ _localId: uid(), contractorName: contractor.contractorName || "", departmentName: "", designation: "", workShiftName: "", perMinuteRate: "", perHourRate: "", perDayRate: "", perMonthRate: "" }]);
      }
    } catch {
      setRateCards([{ _localId: uid(), contractorName: contractor.contractorName || "", departmentName: "", designation: "", workShiftName: "", perMinuteRate: "", perHourRate: "", perDayRate: "", perMonthRate: "" }]);
    }
    setIsRateCardOpen(true);
  };


  // UI
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const [editing, setEditing] = useState<ContractorRead | null>(null);
  const [viewRow, setViewRow] = useState<ContractorRead | null>(null);

  // Suggestions state/refs
  const spRef = useRef<HTMLDivElement>(null);
  const coRef = useRef<HTMLDivElement>(null);

  const [spList, setSpList] = useState<ServiceProvider[]>([]);
  const [coList, setCoList] = useState<Company[]>([]);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]); // Store all companies
  const [spLoading, setSpLoading] = useState(false);
  const [coLoading, setCoLoading] = useState(false);

  const spAbortRef = useRef<AbortController | null>(null);
  const coAbortRef = useRef<AbortController | null>(null);

  const spTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Files (optional uploads)
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    serviceProviderID: null as ID | null,
    companyID: null as ID | null,

    contractorName: "",
    contractorType: "",
    address: "",
    country: "",
    state: "",
    timeZone: "",
    currency: "",
    pfNo: "",
    tanNo: "",
    esiNo: "",
    linNo: "",
    gstNo: "",
    shopRegNo: "",
    financialYearStart: "",
    contactNo: "",
    emailAdd: "",
    companyLogoUrl: "",
    SignatureUrl: "",

    spAutocomplete: "",
    coAutocomplete: "",
  });

  // ---------------------------
  // Load contractors
  // ---------------------------
  const fetchRows = async () => {
    try {
      setLoading(true);
      const all = await fetchJSONSafe<ContractorRead[]>(API.contractors);

      // 🟢 SUPERADMIN → All contractors
      if (user?.role === "SUPERADMIN") {
        setRows(all);
        return;
      }

      // 🟡 MANAGER & EMPLOYEE → Get user mapping first
      const usersRes = await fetch("/backend/users");
      const users = await usersRes.json();
      const currentUser = users.find((u: any) => u.username === user?.username);

      if (currentUser) {
        // Store the user mapping for form auto-fill
        setCurrentUserMapping(currentUser);

        if (user?.role === "MANAGER") {
          const filtered = all.filter(
            (c: any) =>
              c.companyID === currentUser.companyID
          );
          setRows(filtered);
        } else if (user?.role === "EMPLOYEE") {
          const filtered = all.filter(
            (c: any) =>
              c.companyID === currentUser.companyID
          );
          setRows(filtered);
        }
      } else {
        console.warn("User not found in /users mapping.");
        setRows([]);
      }
    } catch (e: any) {
      console.error("Failed to load contractors:", e);
      toast.error("Failed to load data.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchRows();
  }, [user]);

  // Fetch all companies once on component mount
  useEffect(() => {
    const fetchAllCompanies = async () => {
      try {
        const companies = await fetchJSONSafe<Company[]>(API.companies);
        setAllCompanies(companies || []);
      } catch (e) {
        console.error("Failed to load companies:", e);
        toast.error("Failed to load data.");
      }
    };
    fetchAllCompanies();
  }, []);

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

  // Updated company fetch to filter by selected service provider
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
        // Filter companies based on selected service provider
        let filteredCompanies = allCompanies;
        
        // If a service provider is selected, filter companies by serviceProviderID
        if (formData.serviceProviderID) {
          filteredCompanies = allCompanies.filter(co => 
            co.serviceProviderID === formData.serviceProviderID
          );
        }
        
        // Further filter by search query
        const filtered = filteredCompanies.filter(co =>
          (co.companyName ?? "").toLowerCase().includes(query.toLowerCase())
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

  // When service provider changes, clear company selection and update company list
  useEffect(() => {
    if (formData.serviceProviderID) {
      // Clear company selection when SP changes
      setFormData(prev => ({
        ...prev,
        companyID: null,
        coAutocomplete: ""
      }));
      setCoList([]);
      
      // Optionally, you can trigger a company search if there's text in company autocomplete
      if (formData.coAutocomplete.length >= MIN_CHARS) {
        runFetchCompanies(formData.coAutocomplete);
      }
    }
  }, [formData.serviceProviderID]);

  // ---------------------------
  // Form helpers
  // ---------------------------
  const resetForm = () => {
    const baseFormData = {
      serviceProviderID: null as ID | null,
      companyID: null as ID | null,
      contractorName: "",
      contractorType: "",
      address: "",
      country: "",
      state: "",
      timeZone: "",
      currency: "",
      pfNo: "",
      tanNo: "",
      esiNo: "",
      linNo: "",
      gstNo: "",
      shopRegNo: "",
      financialYearStart: "",
      contactNo: "",
      emailAdd: "",
      companyLogoUrl: "",
      SignatureUrl: "",
      spAutocomplete: "",
      coAutocomplete: "",
    };

    // Auto-set Service Provider and Company for MANAGER
    if (user?.role === "MANAGER" && currentUserMapping) {
      baseFormData.serviceProviderID = currentUserMapping.serviceProviderID;
      baseFormData.companyID = currentUserMapping.companyID;
      baseFormData.spAutocomplete = currentUserMapping.serviceProvider?.companyName || "";
      baseFormData.coAutocomplete = currentUserMapping.company?.companyName || "";
    }

    setFormData(baseFormData);
    setLogoFile(null);
    setSignatureFile(null);
    setEditing(null);
    setSpList([]);
    setCoList([]);
    setError(null);
  };

  const handleEdit = (r: ContractorRead) => {
    setEditing(r);

    // For MANAGER, use their mapped IDs instead of the contractor's IDs
    let finalServiceProviderID = r.serviceProviderID ?? r.serviceProvider?.id ?? null;
    let finalCompanyID = r.companyID ?? r.company?.id ?? null;
    let spName = "";
    let coName = "";

    if (user?.role === "MANAGER" && currentUserMapping) {
      // Use MANAGER's mapped IDs
      finalServiceProviderID = currentUserMapping.serviceProviderID;
      finalCompanyID = currentUserMapping.companyID;
      spName = currentUserMapping.serviceProvider?.companyName ?? "";
      coName = currentUserMapping.company?.companyName ?? "";
    } else {
      // For SUPERADMIN, use the contractor's original data
      spName = r.serviceProvider?.companyName ?? r.serviceProviderName ?? "";
      coName = r.company?.companyName ?? r.companyName ?? "";
    }

    setFormData({
      serviceProviderID: finalServiceProviderID,
      companyID: finalCompanyID,
      // ... rest of the fields
      contractorName: r.contractorName ?? "",
      contractorType: r.contractorType ?? "",
      address: r.address ?? "",
      country: r.country ?? "",
      state: r.state ?? "",
      timeZone: r.timeZone ?? "",
      currency: r.currency ?? "",
      pfNo: r.pfNo ?? "",
      tanNo: r.tanNo ?? "",
      esiNo: r.esiNo ?? "",
      linNo: r.linNo ?? "",
      gstNo: r.gstNo ?? "",
      shopRegNo: r.shopRegNo ?? "",
      financialYearStart: r.financialYearStart ?? "",
      contactNo: r.contactNo ?? "",
      emailAdd: r.emailAdd ?? "",
      companyLogoUrl: r.companyLogoUrl ?? "",
      SignatureUrl: r.SignatureUrl ?? "",
      spAutocomplete: spName,
      coAutocomplete: coName,
    });
    setLogoFile(null);
    setSignatureFile(null);
    setIsDialogOpen(true);
  };

  const handleView = (r: ContractorRead) => {
    setViewRow(r);
    setIsViewDialogOpen(true);
  };

  const handleDelete = async (id: ID) => {
    if (!confirm("Delete this contractor?")) return;
    try {
      const res = await fetch(`${API.contractors}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      await fetchRows();
      toast.success("Contractor deleted successfully");
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  };

  // ---------------------------
  // Submit (Create/Update)
  // ---------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // For MANAGER, ensure serviceProviderID and companyID are set from user mapping
    let finalServiceProviderID = formData.serviceProviderID;
    let finalCompanyID = formData.companyID;

    if (user?.role === "MANAGER" && currentUserMapping) {
      finalServiceProviderID = currentUserMapping.serviceProviderID;
      finalCompanyID = currentUserMapping.companyID;
    }

    try {
      // upload files if chosen
      let logoUrl = formData.companyLogoUrl || "";
      let sigUrl = formData.SignatureUrl || "";
      if (logoFile) logoUrl = await uploadFile(logoFile);
      if (signatureFile) sigUrl = await uploadFile(signatureFile);

      const payload: any = {
        serviceProviderID: finalServiceProviderID ?? undefined,
        companyID: finalCompanyID ?? undefined,
        contractorName: formData.contractorName || undefined,
        contractorType: formData.contractorType || undefined,
        address: formData.address || undefined,
        country: formData.country || undefined,
        state: formData.state || undefined,
        timeZone: formData.timeZone || undefined,
        currency: formData.currency || undefined,
        pfNo: formData.pfNo || undefined,
        tanNo: formData.tanNo || undefined,
        esiNo: formData.esiNo || undefined,
        linNo: formData.linNo || undefined,
        gstNo: formData.gstNo || undefined,
        shopRegNo: formData.shopRegNo || undefined,
        financialYearStart: formData.financialYearStart || undefined,
        contactNo: formData.contactNo || undefined,
        emailAdd: formData.emailAdd || undefined,
        companyLogoUrl: logoUrl || undefined,
        SignatureUrl: sigUrl || undefined,
      };

      if (editing) {
        const res = await fetch(`${API.contractors}/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const res = await fetch(API.contractors, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
      }

      await fetchRows();
      resetForm();
      setIsDialogOpen(false);
      toast.success(editing ? "Updated successfully" : "Created successfully");
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------
  // Search
  // ---------------------------
  const filtered = useMemo(() => {
    const t = searchTerm.trim().toLowerCase();
    if (!t) return rows;
    const spNameOf = (r: ContractorRead) => r.serviceProvider?.companyName ?? r.serviceProviderName ?? "";
    const coNameOf = (r: ContractorRead) => r.company?.companyName ?? r.companyName ?? "";
    return rows.filter((r) =>
      [
        r.contractorName,
        r.contractorType,
        r.address,

        r.country,
        r.state,
        r.timeZone,
        r.currency,
        r.contactNo,
        r.emailAdd,
        r.gstNo,
        spNameOf(r),
        coNameOf(r),
      ]
        .filter(Boolean)
        .map((x) => (x ?? "").toLowerCase())
        .some((f) => f.includes(t))
    );
  }, [rows, searchTerm]);

  // ---------------------------
  // Helpers for table names
  // ---------------------------
  const spName = (r: ContractorRead) => r.serviceProvider?.companyName ?? r.serviceProviderName ?? "—";
  const coName = (r: ContractorRead) => r.company?.companyName ?? r.companyName ?? "—";

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <p className="text-gray-600 mt-1 text-sm">Manage contractor records</p>
        </div>

        {canManage && (
              <Button
                onClick={() => { resetForm(); setIsDialogOpen(true); }}
                className="text-sm px-3 py-2"
              >
                <Plus className="w-4 h-4 mr-1" /> Add Contractor
              </Button>
            )}
      </div>

      <FormDrawer
        open={isDialogOpen}
        onOpenChange={(v) => { setIsDialogOpen(v); if (!v) resetForm(); }}
        title={editing ? "Edit Contractor" : "Add New Contractor"}
        description={editing ? "Update contractor details below." : "Fill in details to add a new contractor."}
      >
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Service Provider Autocomplete - Completely hidden for MANAGER */}
              {user?.role !== "MANAGER" && (
                <div ref={spRef} className="space-y-2 relative">
                  <Label>Service Provider *</Label>
                  <Input
                    value={formData.spAutocomplete}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((p) => ({ ...p, spAutocomplete: val, serviceProviderID: null }));
                      runFetchServiceProviders(val);
                    }}
                    onFocus={() => {
                      // Only show suggestions on focus if no selection yet
                      if (!formData.serviceProviderID && formData.spAutocomplete.length >= MIN_CHARS) {
                        runFetchServiceProviders(formData.spAutocomplete);
                      }
                    }}
                    placeholder="Start typing service provider..."
                    autoComplete="off"
                    required
                  />
                  {spList.length > 0 && (
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

              {/* Company Autocomplete - Completely hidden for MANAGER */}
              {user?.role !== "MANAGER" && (
                <div ref={coRef} className="space-y-2 relative">
                  <Label>Company *</Label>
                  <Input
                    value={formData.coAutocomplete}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((p) => ({ ...p, coAutocomplete: val }));
                      runFetchCompanies(val);
                    }}
                    onFocus={() => {
                      const val = formData.coAutocomplete;
                      if (val.length >= MIN_CHARS) runFetchCompanies(val);
                    }}
                    placeholder={formData.serviceProviderID ? "Start typing company..." : "Please select a service provider first"}
                    autoComplete="off"
                    required
                    disabled={!formData.serviceProviderID} // Disable if no SP selected
                  />
                  {coList.length > 0 && (
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
                  {!formData.serviceProviderID && (
                    <p className="text-xs text-amber-600 mt-1">Please select a service provider first to see available companies</p>
                  )}
                </div>
              )}


              {/* Core fields */}
              <div className="space-y-2">
                <Label>Contractor Name</Label>
                <Input
                  value={formData.contractorName}
                  onChange={(e) => setFormData((p) => ({ ...p, contractorName: e.target.value }))}
                  required
                />
              </div>

                          <div className="space-y-2">
                              <Label>Contractor Type</Label>
                             <select className="w-full rounded-md border px-3 py-2" value={formData.contractorType || ""} onChange={(e) => setFormData((p) => ({ ...p, contractorType: e.target.value }))}>
                                <option value="">-- Select Contractor Type --</option>
                                <option value="MSP">Managed Service Provider</option>
                                <option value="MPC">ManPower Contractor</option>
                           
                              </select>
              
                            </div>

              <div className="space-y-2">
                <Label>Address</Label>
                <Textarea
                  value={formData.address}
                  onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input value={formData.country} onChange={(e) => setFormData((p) => ({ ...p, country: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input value={formData.state} onChange={(e) => setFormData((p) => ({ ...p, state: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Time Zone</Label>
                  <Input value={formData.timeZone} onChange={(e) => setFormData((p) => ({ ...p, timeZone: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Input value={formData.currency} onChange={(e) => setFormData((p) => ({ ...p, currency: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2"><Label>PF No</Label><Input value={formData.pfNo} onChange={(e) => setFormData((p) => ({ ...p, pfNo: e.target.value }))} /></div>
                <div className="space-y-2"><Label>TAN No</Label><Input value={formData.tanNo} onChange={(e) => setFormData((p) => ({ ...p, tanNo: e.target.value }))} /></div>
                <div className="space-y-2"><Label>ESI No</Label><Input value={formData.esiNo} onChange={(e) => setFormData((p) => ({ ...p, esiNo: e.target.value }))} /></div>
                <div className="space-y-2"><Label>LIN No</Label><Input value={formData.linNo} onChange={(e) => setFormData((p) => ({ ...p, linNo: e.target.value }))} /></div>
                <div className="space-y-2"><Label>GST No</Label><Input value={formData.gstNo} onChange={(e) => setFormData((p) => ({ ...p, gstNo: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Shop Reg No</Label><Input value={formData.shopRegNo} onChange={(e) => setFormData((p) => ({ ...p, shopRegNo: e.target.value }))} /></div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Financial Year Start</Label>
                  <Input type="date" value={formData.financialYearStart} onChange={(e) => setFormData((p) => ({ ...p, financialYearStart: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Contact Number</Label>
                  <Input value={formData.contactNo} onChange={(e) => setFormData((p) => ({ ...p, contactNo: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input type="email" value={formData.emailAdd} onChange={(e) => setFormData((p) => ({ ...p, emailAdd: e.target.value }))} />
              </div>

              {/* Uploads */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Logo</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Paste logo URL or use Browse"
                      value={formData.companyLogoUrl}
                      onChange={(e) => setFormData((p) => ({ ...p, companyLogoUrl: e.target.value }))}
                    />
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Signature Upload</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Paste signature URL or use Browse"
                      value={formData.SignatureUrl}
                      onChange={(e) => setFormData((p) => ({ ...p, SignatureUrl: e.target.value }))}
                    />
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setSignatureFile(e.target.files?.[0] || null)}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    className="text-blue-600 border-blue-300 hover:bg-blue-50 flex items-center gap-1"
                    onClick={() => {
                      if (editing) {
                        setIsDialogOpen(false);
                        handleOpenRateCard(editing);
                      }
                    }}
                    disabled={!editing}
                    title={!editing ? "Save the contractor first, then add rate card" : "Open rate card"}
                  >
                    <IndianRupee className="w-4 h-4" /> Contractor Rate Card
                  </Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" className="" disabled={saving}>
                      {saving ? "Saving..." : editing ? "Update Contractor" : "Add Contractor"}
                    </Button>
                  </div>
                </div>
              </div>
            </form>
      </FormDrawer>

      {/* View Drawer */}
      <FormDrawer
        open={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
        title="Contractor Details"
        description="Read-only details"
      >
          {viewRow && (
            <div className="space-y-3">
              <p><strong>Name:</strong> {viewRow.contractorName || "—"}</p>
              <p><strong>Address:</strong> {viewRow.address || "—"}</p>
              <p><strong>Country:</strong> {viewRow.country || "—"}</p>
              <p><strong>State:</strong> {viewRow.state || "—"}</p>
              <p><strong>TimeZone:</strong> {viewRow.timeZone || "—"}</p>
              <p><strong>Currency:</strong> {viewRow.currency || "—"}</p>
              <p><strong>PF:</strong> {viewRow.pfNo || "—"}</p>
              <p><strong>TAN:</strong> {viewRow.tanNo || "—"}</p>
              <p><strong>ESI:</strong> {viewRow.esiNo || "—"}</p>
              <p><strong>LIN:</strong> {viewRow.linNo || "—"}</p>
              <p><strong>GST:</strong> {viewRow.gstNo || "—"}</p>
              <p><strong>Shop Reg:</strong> {viewRow.shopRegNo || "—"}</p>
              <p><strong>FY Start:</strong> {viewRow.financialYearStart || "—"}</p>
              <p><strong>Contact:</strong> {viewRow.contactNo || "—"}</p>
              <p><strong>Email:</strong> {viewRow.emailAdd || "—"}</p>
              {viewRow.companyLogoUrl && <p><strong>Logo:</strong> <a className="text-blue-600 underline" href={viewRow.companyLogoUrl} target="_blank">Open</a></p>}
              {viewRow.SignatureUrl && <p><strong>Signature:</strong> <a className="text-blue-600 underline" href={viewRow.SignatureUrl} target="_blank">Open</a></p>}
            </div>
          )}
          <div className="flex justify-end pt-4">
            <Button onClick={() => setIsViewDialogOpen(false)} variant="outline">Close</Button>
          </div>
      </FormDrawer>

      {/* Rate Card Drawer */}
      <FormDrawer
        open={isRateCardOpen}
        onOpenChange={setIsRateCardOpen}
        title={`Contractor Rate Card — ${rateCardContractor?.contractorName || ""}`}
        description="Define rate cards for this contractor by designation."
      >
          <div className="space-y-4">
            {rateCards.map((rc, idx) => (
              <div key={rc._localId} className="border rounded-lg p-4 space-y-3 relative bg-gray-50/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-500">Entry {idx + 1}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRateCardRow(rc._localId)}
                    className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Contractor Name</label>
                    <Input
                      value={rc.contractorName}
                      onChange={(e) => updateRateCardRow(rc._localId, "contractorName", e.target.value)}
                      placeholder="Contractor name"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Department</label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={rc.departmentName}
                      onChange={(e) => updateRateCardRow(rc._localId, "departmentName", e.target.value)}
                    >
                      <option value="">Select Department</option>
                      {rcDepartments.map((d) => (
                        <option key={d.id} value={d.departmentName || ""}>{d.departmentName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Designation</label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={rc.designation}
                      onChange={(e) => updateRateCardRow(rc._localId, "designation", e.target.value)}
                    >
                      <option value="">Select Designation</option>
                      {rcDesignations.map((d) => (
                        <option key={d.id} value={d.designation || ""}>{d.designation}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Work Shift</label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={rc.workShiftName}
                      onChange={(e) => updateRateCardRow(rc._localId, "workShiftName", e.target.value)}
                    >
                      <option value="">Select Work Shift</option>
                      {rcWorkShifts.map((w) => (
                        <option key={w.id} value={w.workShiftName || ""}>{w.workShiftName}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Per Minute (₹)</label>
                    <Input
                      type="number"
                      value={rc.perMinuteRate}
                      onChange={(e) => updateRateCardRow(rc._localId, "perMinuteRate", e.target.value)}
                      placeholder="0"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Per Hour (₹)</label>
                    <Input
                      type="number"
                      value={rc.perHourRate}
                      onChange={(e) => updateRateCardRow(rc._localId, "perHourRate", e.target.value)}
                      placeholder="0"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Per Day (₹)</label>
                    <Input
                      type="number"
                      value={rc.perDayRate}
                      onChange={(e) => updateRateCardRow(rc._localId, "perDayRate", e.target.value)}
                      placeholder="0"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Per Month (₹)</label>
                    <Input
                      type="number"
                      value={rc.perMonthRate}
                      onChange={(e) => updateRateCardRow(rc._localId, "perMonthRate", e.target.value)}
                      placeholder="0"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            ))}
            {rateCards.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm border rounded-lg">
                No rate entries. Click &quot;Add Row&quot; to begin.
              </div>
            )}

            <Button type="button" variant="outline" size="sm" onClick={addRateCardRow}>
              <Plus className="w-4 h-4 mr-1" /> Add Row
            </Button>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsRateCardOpen(false)}>Close</Button>
            <Button
              className=""
              onClick={async () => {
                if (!rateCardContractor) return;
                try {
                  const payload = {
                    rateCards: rateCards.map(rc => ({
                      contractorName: rc.contractorName || undefined,
                      departmentName: rc.departmentName || undefined,
                      designation: rc.designation || undefined,
                      workShiftName: rc.workShiftName || undefined,
                      perMinuteRate: rc.perMinuteRate ? parseFloat(rc.perMinuteRate) : 0,
                      perHourRate: rc.perHourRate ? parseFloat(rc.perHourRate) : 0,
                      perDayRate: rc.perDayRate ? parseFloat(rc.perDayRate) : 0,
                      perMonthRate: rc.perMonthRate ? parseFloat(rc.perMonthRate) : 0,
                    })),
                  };
                  const res = await fetch(`${API.contractors}/${rateCardContractor.id}/rate-cards`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  });
                  if (!res.ok) throw new Error(await res.text());
                  setIsRateCardOpen(false);
                  toast.success("Rate card saved successfully");
                } catch (e: any) {
                  toast.error(e?.message || "Failed to save rate cards");
                }
              }}
            >
              Save Rate Card
            </Button>
          </div>
      </FormDrawer>

      {/* Search */}
      <Card>
        <CardContent className="p-6 flex items-center space-x-4">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search contractors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
          <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
            {filtered.length} contractors
          </Badge>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="mdi:account-hard-hat" className="w-5 h-5" /> Contractor List
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 w-full overflow-x-auto">
          {loading ? (
            <div className="p-6 text-sm text-gray-500">Loading…</div>
          ) : (
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Contractor</TableHead>
                  <TableHead>Service Provider</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>GST</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Icon icon="mdi:account-search" className="w-12 h-12 text-gray-300" />
                        <p>No contractors found</p>
                        <p className="text-sm">Try adjusting your search criteria</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{r.contractorName || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{spName(r)}</TableCell>
                      <TableCell className="whitespace-nowrap">{coName(r)}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.emailAdd || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.contactNo || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.gstNo || "—"}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/*  Everyone can view */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView(r)}
                            className="h-7 w-7 p-0"
                            title="View"
                          >
                            <Eye className="w-3 h-3" />
                          </Button>

                          {/* Rate Card button */}
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenRateCard(r)}
                              className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex items-center gap-1"
                              title="Contractor Rate"
                            >
                              <IndianRupee className="w-3 h-3" /> Rate
                            </Button>
                          )}

                          {/* ✏️ Only SUPERADMIN and MANAGER can edit */}
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(r)}
                              className="h-7 w-7 p-0"
                              title="Edit"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                          )}

                          {/* 🗑️ Only SUPERADMIN and MANAGER can delete */}
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(r.id)}
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
    </div>
  );
}