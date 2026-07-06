"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { FormDrawer } from "../components/ui/form-drawer";
import { PageHeader } from "../components/app/page-header";
import { FilterBar, FilterSelect } from "../components/app/filter-bar";
import { EntityListShell } from "../components/app/entity-list-shell";
import type { DataTableColumn } from "../components/app/data-table";
import { EntityRowActions } from "../components/app/entity-row-actions";
import { DetailCard } from "../components/app/detail-card";
import { EntityDetailHero, EntityDetailLayout } from "../components/app/entity-detail-layout";
import { FormSectionNav } from "../components/app/form-section-nav";
import { useClientTable, sortRows } from "../hooks/use-client-table";
import { NoticeBanner } from "../components/ui/notice-banner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Plus, Edit, Trash2, Save, UserPlus, Briefcase } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { toast } from "sonner";
import { PdfUploadField } from "../components/PdfUploadField";
import { getSidebarContext } from "../utils/sidebarContext";
import {
  canDesktopManagerManage,
  filterCompanyScopedRecords,
  resolveScopeUserMapping,
} from "../utils/scopeContext";
import { LocationFields } from "../components/ui/location-fields";
import { TimezoneSelect } from "../components/ui/timezone-select";
import { SearchSuggestInput } from "../components/SearchSuggestInput";
import { fetchCurrencies } from "../utils/geoApi";

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
  shopRegNo?: string | null;
  shopRegCertUrl?: string | null;
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

  contractorBranches?: {
    id: number;
    contractorID: number;
    branchID: number;
    branch?: Branch | null;
  }[];
}

interface ServiceProvider {
  id: ID;
  companyName: string;
}

interface Branch {
  id: number;
  branchName: string;
  companyID?: number | null;
  serviceProviderID?: number | null;
}

interface Company {
  id: ID;
  companyName: string;
  serviceProviderID?: ID;
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
  branches: "/backend/branches",
  users: "/backend/users",
};

const MIN_CHARS = 0;
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
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN" || canDesktopManagerManage(user)
  const isEmployee = user?.role === "EMPLOYEE";

  const canManageContractorAdmins =
    user?.role === "SUPERADMIN" || user?.role === "COMPANY_ADMIN";
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
  const table = useClientTable("contractorName");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [branchFilterList, setBranchFilterList] = useState<Branch[]>([]);
  const [branchFilterLoading, setBranchFilterLoading] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [contractorFormTab, setContractorFormTab] = useState("basic");
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const [editing, setEditing] = useState<ContractorRead | null>(null);
  const [viewRow, setViewRow] = useState<ContractorRead | null>(null);

  const CONTRACTOR_ADMIN_ROLE = "CONTRACTOR_ADMIN";

  const [showContractorAdminPanel, setShowContractorAdminPanel] = useState(false);
  const [selectedContractor, setSelectedContractor] = useState<ContractorRead | null>(null);
  const [contractorAdmins, setContractorAdmins] = useState<any[]>([]);
  const [editingContractorAdmin, setEditingContractorAdmin] = useState<any | null>(null);
  const [contractorAdminSaving, setContractorAdminSaving] = useState(false);

  const [contractorAdminForm, setContractorAdminForm] = useState({
    username: "",
    password: "",
    firstName: "",
    lastName: "",
    contactNo: "",
    email: "",
    role: CONTRACTOR_ADMIN_ROLE,
    isActive: true,
  });

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

    branchSearch: "",
    branchIDs: [] as number[],
    selectedBranches: [] as Branch[],
    contractorName: "",
    contractorType: "",
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
    shopRegNo: "",
    shopRegCertUrl: "",
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

  const fetchBranchFilterList = async () => {
    try {
      setBranchFilterLoading(true);

      const all = await fetchJSONSafe<Branch[]>(API.branches);
      const ctx = getSidebarContext();

      const activeCompanyID =
        ctx?.companyID ??
        user?.companyID ??
        currentUserMapping?.companyID ??
        null;

      let filtered = Array.isArray(all) ? all : [];

      if (activeCompanyID) {
        filtered = filtered.filter(
          (b) => Number(b.companyID) === Number(activeCompanyID)
        );
      }

      if (user?.role === "BRANCH_ADMIN") {
        const branchesID = currentUserMapping?.branchesID ?? user?.branchesID;
        if (branchesID) {
          filtered = filtered.filter(
            (b) => Number(b.id) === Number(branchesID)
          );
          setBranchFilter(String(branchesID));
        }
      }

      setBranchFilterList(filtered);
    } catch (e) {
      console.error("Failed to load branch filter list:", e);
      setBranchFilterList([]);
    } finally {
      setBranchFilterLoading(false);
    }
  };


  const fetchRows = async () => {
    try {
      setLoading(true);
      const all = await fetchJSONSafe<ContractorRead[]>(API.contractors);

      const mapping = await resolveScopeUserMapping(user);
      if (mapping) setCurrentUserMapping(mapping);

      const ctx = getSidebarContext();

      const activeCompanyID =
        ctx?.companyID ??
        user?.companyID ??
        mapping?.companyID ??
        null;

      let visibleRows = Array.isArray(all) ? all : [];

      // Important: contractors may have companyID null but mapped branch has companyID.
      // So include contractor if its direct companyID OR any mapped branch companyID matches.
      if (activeCompanyID) {
        visibleRows = visibleRows.filter((r: any) => {
          const directCompanyMatch =
            Number(r.companyID) === Number(activeCompanyID) ||
            Number(r.company?.id) === Number(activeCompanyID);

          const branchCompanyMatch = Array.isArray(r.contractorBranches)
            ? r.contractorBranches.some(
              (cb: any) => Number(cb.branch?.companyID) === Number(activeCompanyID)
            )
            : false;

          return directCompanyMatch || branchCompanyMatch;
        });
      } else {
        visibleRows = await filterCompanyScopedRecords(all, user);
      }

      setRows(visibleRows);
    } catch (e: any) {
      console.error("Failed to load contractors:", e);
      toast.error("Failed to load data.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchRows();
      fetchBranchFilterList();
    }
  }, [user]);

  const closeContractorPagePanels = () => {
  resetForm();

  setIsDialogOpen(false);
  setIsViewDialogOpen(false);
  setViewRow(null);

  setShowContractorAdminPanel(false);
  setSelectedContractor(null);
  setContractorAdmins([]);
  setEditingContractorAdmin(null);
  resetContractorAdminForm();

  setIsRateCardOpen(false);
  setRateCardContractor(null);
  setRateCards([]);

  setSpList([]);
  setCoList([]);
};

 useEffect(() => {
  const handler = () => {
    if (user) {
      fetchRows();
      fetchBranchFilterList();
    }
  };

  const sidebarPageClickHandler = (e: any) => {
    if (e.detail?.path === "/contractors") {
      closeContractorPagePanels();

      if (user) {
        fetchRows();
        fetchBranchFilterList();
      }
    }
  };

  window.addEventListener("sidebar-context-changed", handler);
  window.addEventListener("app-data-refresh", handler);
  window.addEventListener("sidebar-main-page-click", sidebarPageClickHandler);

  return () => {
    window.removeEventListener("sidebar-context-changed", handler);
    window.removeEventListener("app-data-refresh", handler);
    window.removeEventListener("sidebar-main-page-click", sidebarPageClickHandler);
  };
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
    setContractorFormTab("basic");
    const baseFormData = {
      serviceProviderID: null as ID | null,
      branchSearch: "",
      branchIDs: [],
      selectedBranches: [],
      companyID: null as ID | null,
      contractorName: "",
      contractorType: "",
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
      shopRegNo: "",
      shopRegCertUrl: "",
      financialYearStart: "",
      contactNo: "",
      emailAdd: "",
      companyLogoUrl: "",
      SignatureUrl: "",
      spAutocomplete: "",
      coAutocomplete: "",
    };

    // Auto-set Service Provider and Company based on role
    if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
      baseFormData.serviceProviderID = currentUserMapping.serviceProviderID;
      baseFormData.companyID = currentUserMapping.companyID;
      baseFormData.spAutocomplete = currentUserMapping.serviceProvider?.companyName || "";
      baseFormData.coAutocomplete = currentUserMapping.company?.companyName || "";
    } else if (user?.role === "SUPERADMIN") {
      const ctx = getSidebarContext();
      if (ctx) {
        baseFormData.serviceProviderID = ctx.serviceProviderID;
        baseFormData.companyID = ctx.companyID;
        baseFormData.spAutocomplete = ctx.serviceProviderName;
        baseFormData.coAutocomplete = ctx.companyName;
      }
    } else if (user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN") {
      const ctx = getSidebarContext();
      baseFormData.serviceProviderID = ctx?.serviceProviderID ?? user?.serviceProviderID ?? currentUserMapping?.serviceProviderID ?? null;
      baseFormData.companyID = ctx?.companyID ?? user?.companyID ?? currentUserMapping?.companyID ?? null;
      baseFormData.spAutocomplete = ctx?.serviceProviderName ?? currentUserMapping?.serviceProvider?.companyName ?? "";
      baseFormData.coAutocomplete = ctx?.companyName ?? currentUserMapping?.company?.companyName ?? "";
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

    if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
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

    const mappedBranches =
      Array.isArray((r as any).contractorBranches)
        ? (r as any).contractorBranches
          .map((x: any) => x.branch)
          .filter(Boolean)
        : [];

    setFormData({
      serviceProviderID: finalServiceProviderID,

      companyID: finalCompanyID,
      branchSearch: "",
      branchIDs: mappedBranches.map((b: any) => Number(b.id)),
      selectedBranches: mappedBranches,
      contractorName: r.contractorName ?? "",
      contractorType: r.contractorType ?? "",
      address: r.address ?? "",
      country: r.country ?? "",
      state: r.state ?? "",
      city: r.city ?? "",
      pincode: r.pincode ?? "",
      timeZone: r.timeZone ?? "",
      currency: r.currency ?? "",
      pfNo: r.pfNo ?? "",
      tanNo: r.tanNo ?? "",
      esiNo: r.esiNo ?? "",
      linNo: r.linNo ?? "",
      gstNo: r.gstNo ?? "",
      gstCertUrl: (r as any).gstCertUrl ?? "",
      shopRegNo: r.shopRegNo ?? "",
      shopRegCertUrl: (r as any).shopRegCertUrl ?? "",
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

  const fetchBranchSuggestions = async (query: string): Promise<Branch[]> => {
    const all = await fetchJSONSafe<Branch[]>(API.branches);
    const q = query.trim().toLowerCase();

    const ctx = getSidebarContext();

    const activeCompanyID =
      formData.companyID ??
      ctx?.companyID ??
      user?.companyID ??
      currentUserMapping?.companyID ??
      null;

    let filtered = Array.isArray(all) ? all : [];

    if (activeCompanyID) {
      filtered = filtered.filter(
        (b) => Number(b.companyID) === Number(activeCompanyID)
      );
    }

    if (q) {
      filtered = filtered.filter((b) =>
        String(b.branchName || "").toLowerCase().includes(q)
      );
    }

    const selectedIds = new Set(formData.branchIDs.map(Number));

    return filtered
      .filter((b) => !selectedIds.has(Number(b.id)))
      .slice(0, 20);
  };


  const addContractorBranch = (branch: Branch) => {
    if (!branch?.id) return;

    setFormData((p) => {
      const exists = p.branchIDs.includes(Number(branch.id));
      if (exists) {
        return { ...p, branchSearch: "" };
      }

      return {
        ...p,
        branchSearch: "",
        companyID: p.companyID || branch.companyID || null,
        serviceProviderID: p.serviceProviderID || branch.serviceProviderID || null,
        branchIDs: [...p.branchIDs, Number(branch.id)],
        selectedBranches: [...p.selectedBranches, branch],
      };
    });
  };

  const removeContractorBranch = (branchID: number) => {
    setFormData((p) => ({
      ...p,
      branchIDs: p.branchIDs.filter((id) => Number(id) !== Number(branchID)),
      selectedBranches: p.selectedBranches.filter(
        (b) => Number(b.id) !== Number(branchID)
      ),
    }));
  };



  // ---------------------------
  // Submit (Create/Update)
  // ---------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const validationErrors: string[] = [];
    if (!formData.contractorName?.trim()) validationErrors.push("Contractor Name is required");
    if (validationErrors.length > 0) {
      validationErrors.forEach(msg => toast.error(msg));
      return;
    }

    setSaving(true);
    setError(null);

    // Ensure serviceProviderID and companyID are set from user mapping / sidebar context
    let finalServiceProviderID = formData.serviceProviderID;
    let finalCompanyID = formData.companyID;

    const selectedBranchFirst = formData.selectedBranches?.[0];

    if (selectedBranchFirst) {
      finalServiceProviderID =
        finalServiceProviderID || selectedBranchFirst.serviceProviderID || null;
      finalCompanyID =
        finalCompanyID || selectedBranchFirst.companyID || null;
    }

    if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
      finalServiceProviderID =
        finalServiceProviderID || currentUserMapping.serviceProviderID;
      finalCompanyID =
        finalCompanyID || currentUserMapping.companyID;
    } else if ((user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN") && !finalCompanyID) {
      const ctx = getSidebarContext();
      finalServiceProviderID =
        finalServiceProviderID ||
        ctx?.serviceProviderID ||
        user?.serviceProviderID ||
        currentUserMapping?.serviceProviderID ||
        null;

      finalCompanyID =
        finalCompanyID ||
        ctx?.companyID ||
        user?.companyID ||
        currentUserMapping?.companyID ||
        null;
    }


    try {
      // upload files if chosen
      let logoUrl = formData.companyLogoUrl || "";
      let sigUrl = formData.SignatureUrl || "";
      if (logoFile) logoUrl = await uploadFile(logoFile);
      if (signatureFile) sigUrl = await uploadFile(signatureFile);

      const payload: any = {
        serviceProviderID:
          finalServiceProviderID ??
          formData.selectedBranches?.[0]?.serviceProviderID ??
          undefined,

        companyID:
          finalCompanyID ??
          formData.selectedBranches?.[0]?.companyID ??
          undefined,
        branchIDs: formData.branchIDs,
        contractorName: formData.contractorName || undefined,
        contractorType: formData.contractorType || undefined,
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
        shopRegNo: formData.shopRegNo || undefined,
        shopRegCertUrl: formData.shopRegCertUrl || undefined,
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

  const resetContractorAdminForm = () => {
    setContractorAdminForm({
      username: "",
      password: "",
      firstName: "",
      lastName: "",
      contactNo: "",
      email: "",
      role: CONTRACTOR_ADMIN_ROLE,
      isActive: true,
    });
  };

  const openContractorAdminPanel = async (contractor: ContractorRead) => {
    setSelectedContractor(contractor);
    setShowContractorAdminPanel(true);
    setEditingContractorAdmin(null);
    setIsDialogOpen(false);
    setIsViewDialogOpen(false);
    resetContractorAdminForm();

    try {
      const data = await fetchJSONSafe<any[]>(API.users);
      const users = Array.isArray(data) ? data : [];

      const filteredUsers = users.filter((u: any) => {
        return (
          String(u.role).toUpperCase() === CONTRACTOR_ADMIN_ROLE &&
          Number(u.contractorID) === Number(contractor.id)
        );
      });

      setContractorAdmins(filteredUsers);
    } catch (e) {
      console.error("Failed to load contractor admins:", e);
      setContractorAdmins([]);
    }
  };

  const handleEditContractorAdmin = (admin: any) => {
    setEditingContractorAdmin(admin);

    setContractorAdminForm({
      username: admin.username || "",
      password: "",
      firstName: admin.firstName || "",
      lastName: admin.lastName || "",
      contactNo: admin.contactNo || "",
      email: admin.email || "",
      role: CONTRACTOR_ADMIN_ROLE,
      isActive: admin.isActive ?? true,
    });
  };

  const saveContractorAdmin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (contractorAdminSaving) return;

    if (!selectedContractor?.id) {
      toast.error("Contractor not selected");
      return;
    }

    if (!contractorAdminForm.username.trim()) {
      toast.error("Username is required");
      return;
    }

    if (!editingContractorAdmin && !contractorAdminForm.password.trim()) {
      toast.error("Password is required");
      return;
    }

    if (contractorAdminForm.password && contractorAdminForm.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setContractorAdminSaving(true);

    try {
      const isEdit = Boolean(editingContractorAdmin);

      const payload: any = {
        username: contractorAdminForm.username.trim(),
        role: CONTRACTOR_ADMIN_ROLE,
        firstName: contractorAdminForm.firstName?.trim() || "",
        lastName: contractorAdminForm.lastName?.trim() || "",
        contactNo: contractorAdminForm.contactNo?.trim() || "",
        email: contractorAdminForm.email?.trim() || "",
        contractorID: selectedContractor.id,
        companyID: selectedContractor.companyID,
        serviceProviderID: selectedContractor.serviceProviderID,
        isActive: contractorAdminForm.isActive,
      };

      if (contractorAdminForm.password.trim()) {
        payload.password = contractorAdminForm.password;
      }

      const res = await fetch(
        isEdit ? `${API.users}/${editingContractorAdmin.id}` : API.users,
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) throw new Error(await res.text());

      toast.success(
        isEdit
          ? "Contractor admin user updated successfully"
          : "Contractor admin user created successfully"
      );

      setEditingContractorAdmin(null);
      resetContractorAdminForm();
      await openContractorAdminPanel(selectedContractor);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to save contractor admin");
    } finally {
      setContractorAdminSaving(false);
    }
  };

  const handleDeleteContractorAdmin = async (id: number) => {
    if (!confirm("Delete Contractor Admin?")) return;

    try {
      const res = await fetch(`${API.users}/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error(await res.text());

      toast.success("Contractor admin deleted");

      if (selectedContractor) {
        await openContractorAdminPanel(selectedContractor);
      }
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  };

  const closeContractorAdminPanel = () => {
    setShowContractorAdminPanel(false);
    setSelectedContractor(null);
    setContractorAdmins([]);
    setEditingContractorAdmin(null);
    resetContractorAdminForm();
  };

  // ---------------------------
  // Search / filters
  // ---------------------------

  const filtered = useMemo(() => {
    const t = table.search.trim().toLowerCase();

    const spNameOf = (r: ContractorRead) =>
      r.serviceProvider?.companyName ?? r.serviceProviderName ?? "";

    const coNameOf = (r: ContractorRead) =>
      r.company?.companyName ?? r.companyName ?? "";

    let list = rows.filter((r) => {
      const contractorBranchIds = Array.isArray((r as any).contractorBranches)
        ? (r as any).contractorBranches
          .map((cb: any) => String(cb.branchID ?? cb.branch?.id ?? ""))
          .filter(Boolean)
        : [];

      const matchesBranch =
        branchFilter === "ALL" ||
        contractorBranchIds.includes(branchFilter);

      const matchesSearch =
        !t ||
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
          ...(Array.isArray((r as any).contractorBranches)
            ? (r as any).contractorBranches.map(
              (cb: any) => cb.branch?.branchName
            )
            : []),
        ]
          .filter(Boolean)
          .map((x) => String(x ?? "").toLowerCase())
          .some((f) => f.includes(t));

      return matchesBranch && matchesSearch;
    });

    return sortRows(list, table.sortBy, table.sortDir, (row, key) => {
      const r = row as ContractorRead;
      if (key === "contractorName") return r.contractorName ?? "";
      if (key === "contractorType") return r.contractorType ?? "";
      if (key === "emailAdd") return r.emailAdd ?? "";
      if (key === "contactNo") return r.contactNo ?? "";
      if (key === "gstNo") return r.gstNo ?? "";
      return "";
    });
  }, [rows, table.search, table.sortBy, table.sortDir, branchFilter]);

  const branchFilterOptions = useMemo(
    () => [
      { value: "ALL", label: "All branches" },
      ...branchFilterList.map((b) => ({
        value: String(b.id),
        label: b.branchName || `Branch #${b.id}`,
      })),
    ],
    [branchFilterList],
  );

  const contractorTypeLabels: Record<string, string> = {
    MSP: "MSP",
    CA: "Commission Agent",
    MPC: "ManPower",
  };

  const contractorColumns = useMemo((): DataTableColumn<ContractorRead>[] => [
    {
      key: "contractorName",
      header: "Contractor",
      sortable: true,
      colSpan: 3,
      cell: (r) => <span className="font-medium">{r.contractorName || "—"}</span>,
    },
    {
      key: "contractorType",
      header: "Type",
      sortable: true,
      colSpan: 2,
      cell: (r) => (
        <>
          {(r.contractorType || "").split(",").filter(Boolean).map((t) => (
            <Badge key={t} variant="secondary" className="mr-1 text-xs">
              {contractorTypeLabels[t] || t}
            </Badge>
          ))}
          {!r.contractorType && "—"}
        </>
      ),
    },
    {
      key: "emailAdd",
      header: "Email",
      sortable: true,
      colSpan: 3,
      cell: (r) => r.emailAdd || "—",
    },
    {
      key: "contactNo",
      header: "Contact",
      sortable: true,
      colSpan: 2,
      cell: (r) => r.contactNo || "—",
    },
    {
      key: "gstNo",
      header: "GST",
      sortable: true,
      colSpan: 2,
      cell: (r) => r.gstNo || "—",
    },
    {
      key: "actions",
      header: "Actions",
      colSpan: 2,
      align: "right",
      cell: (r) => (
        <EntityRowActions
          onView={() => handleView(r)}
          onEdit={canManage ? () => handleEdit(r) : undefined}
          onDelete={canManage ? () => handleDelete(r.id) : undefined}
          extra={
            canManageContractorAdmins
              ? [{
                  icon: UserPlus,
                  title: "Manage Contractor Admin Users",
                  onClick: () => openContractorAdminPanel(r),
                  className: "text-indigo-600",
                }]
              : undefined
          }
        />
      ),
    },
  ], [canManage, canManageContractorAdmins]);

  // ---------------------------
  // Helpers for table names
  // ---------------------------
  const spName = (r: ContractorRead) => r.serviceProvider?.companyName ?? r.serviceProviderName ?? "—";
  const coName = (r: ContractorRead) => r.company?.companyName ?? r.companyName ?? "—";

  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter">
      <PageHeader
        icon={Briefcase}
        title="Contractors"
        description="Manage contractor records"
        actions={
          canManage && !isDialogOpen && !isViewDialogOpen && !showContractorAdminPanel ? (
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Add Contractor
            </Button>
          ) : null
        }
      />

      <FormDrawer
  open={isDialogOpen}
  onOpenChange={(v) => {
    setIsDialogOpen(v);
    if (!v) closeContractorPagePanels();
  }}
  title={editing ? "Edit Contractor" : "Add New Contractor"}
  description={editing ? "Update contractor details below." : "Fill in details to add a new contractor."}
>
        {error && (
          <NoticeBanner variant="error" compact className="mb-4">
            {error}
          </NoticeBanner>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormSectionNav
            active={contractorFormTab}
            onChange={setContractorFormTab}
            sections={[
              { id: "basic", label: "Basic Information" },
              { id: "location", label: "Location & Settings" },
              { id: "compliance", label: "Compliance & Tax" },
              { id: "contact", label: "Contact & Branding" },
            ]}
          />

          {contractorFormTab === "basic" && (
          <>
          {/* Service Provider - auto-filled from sidebar */}
          {false && (
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

          {/* Company - auto-filled from sidebar */}
          {false && (
            <div ref={coRef} className="space-y-2 relative">
              <Label>Company *</Label>
              <Input
                value={formData.coAutocomplete}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData((p) => ({ ...p, coAutocomplete: val, companyID: null }));
                  runFetchCompanies(val);
                }}
                onFocus={() => {
                  if (!formData.companyID && formData.coAutocomplete.length >= MIN_CHARS) {
                    runFetchCompanies(formData.coAutocomplete);
                  }
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
          <div className="space-y-3 rounded-xl border bg-gray-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Assign Branches</Label>
                <p className="text-xs text-gray-500">
                  Search and add branches under the selected company
                </p>
              </div>

              <Badge variant="secondary">
                {formData.selectedBranches.length} selected
              </Badge>
            </div>

            <SearchSuggestInput
              label=""
              placeholder="Search branch and click to add..."
              value={formData.branchSearch}
              onChange={(v) => setFormData((p) => ({ ...p, branchSearch: v }))}
              onSelect={({ item }) => addContractorBranch(item)}
              fetchData={fetchBranchSuggestions}
              displayField="branchName"
              valueField="id"
            />

            <div className="flex flex-wrap gap-2">
              {formData.selectedBranches.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No branches selected. Contractor will not be mapped to any branch.
                </p>
              ) : (
                formData.selectedBranches.map((branch) => (
                  <Badge
                    key={branch.id}
                    variant="secondary"
                    className="flex items-center gap-2 px-3 py-1"
                  >
                    {branch.branchName}
                    <button
                      type="button"
                      onClick={() => removeContractorBranch(branch.id)}
                      className="text-red-600 hover:text-red-700 font-bold"
                    >
                      ×
                    </button>
                  </Badge>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Contractor Name</Label>
            <Input
              value={formData.contractorName}
              onChange={(e) => setFormData((p) => ({ ...p, contractorName: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Contractor Type (Select Multiple)</Label>
            {(() => {
              const CONTRACTOR_TYPES = [
                { value: "MSP", label: "Managed Service Provider", hint: "Contractor pays Employee Salary" },
                { value: "CA", label: "Commission Agent", hint: "Company pays Employee Salary and gives commission to contractor" },
              ];
              const selected = (formData.contractorType || "").split(",").filter(Boolean);
              const toggle = (val: string) => {
                const next = selected.includes(val)
                  ? selected.filter((v) => v !== val)
                  : [...selected, val];
                setFormData((p) => ({ ...p, contractorType: next.join(",") }));
              };
              return (
                <div className="space-y-2">
                  {CONTRACTOR_TYPES.map((ct) => (
                    <label key={ct.value} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected.includes(ct.value)}
                        onChange={() => toggle(ct.value)}
                        className="mt-1 h-4 w-4 rounded border-gray-300"
                      />
                      <div>
                        <span className="text-sm font-medium">{ct.label}</span>
                        <p className="text-xs text-gray-500">{ct.hint}</p>
                      </div>
                    </label>
                  ))}
                </div>
              );
            })()}
          </div>

          <div className="space-y-2">
            <Label>Address</Label>
            <Textarea
              value={formData.address}
              onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
              rows={3}
            />
          </div>

          </>
          )}

          {contractorFormTab === "location" && (
          <>
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

          </>
          )}

          {contractorFormTab === "compliance" && (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <Label>Shop Reg No</Label>
              <Input value={formData.shopRegNo} onChange={(e) => setFormData((p) => ({ ...p, shopRegNo: e.target.value }))} />
              <PdfUploadField label="Shop registration (PDF)" value={formData.shopRegCertUrl} onChange={(url) => setFormData((p) => ({ ...p, shopRegCertUrl: url ?? "" }))} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Financial Year Start</Label>
              <select
                value={formData.financialYearStart || ""}
                onChange={(e) => setFormData((p) => ({ ...p, financialYearStart: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-sm border-[#d0d0d0] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 focus-visible:border-[#b0b0b0]"
              >
                <option value="">Select financial year start</option>
                <option value="1st Jan">1st Jan</option>
                <option value="1st April">1st April</option>
              </select>
            </div>
          </div>

          </>
          )}

          {contractorFormTab === "contact" && (
          <>
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

          </>
          )}

          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-end">
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
        showHeaderCancel
        cancelLabel="Close"
      >
        {viewRow && (
          <EntityDetailLayout
            hero={
              <EntityDetailHero
                title={viewRow.contractorName || "Contractor"}
                subtitle={<span>{viewRow.contractorType}</span>}
              />
            }
          >
            <DetailCard
              title="Overview"
              subtitle="Core contractor details"
              rows={[
                { label: "Contractor name", value: viewRow.contractorName },
                { label: "Contractor type", value: viewRow.contractorType },
                { label: "Address", value: viewRow.address },
              ]}
            />
            <DetailCard
              title="Location"
              subtitle="Regional settings"
              rows={[
                { label: "Country", value: viewRow.country },
                { label: "State", value: viewRow.state },
                { label: "Time zone", value: viewRow.timeZone },
                { label: "Currency", value: viewRow.currency },
              ]}
            />
            <DetailCard
              title="Contact"
              subtitle="How to reach this contractor"
              rows={[
                { label: "Contact number", value: viewRow.contactNo },
                { label: "Email", value: viewRow.emailAdd },
              ]}
            />
            <DetailCard
              title="Statutory"
              subtitle="Government and legal identifiers"
              rows={[
                { label: "PF", value: viewRow.pfNo },
                { label: "TAN", value: viewRow.tanNo },
                { label: "ESI", value: viewRow.esiNo },
                { label: "LIN", value: viewRow.linNo },
                { label: "GST", value: viewRow.gstNo },
                { label: "Shop registration", value: viewRow.shopRegNo },
                { label: "Financial year start", value: viewRow.financialYearStart },
              ]}
            />
            {(viewRow.companyLogoUrl || viewRow.SignatureUrl) ? (
              <DetailCard title="Branding" subtitle="Logo and signature" className="lg:col-span-2">
                <div className="flex flex-wrap gap-4">
                  {viewRow.companyLogoUrl ? (
                    <a href={viewRow.companyLogoUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline text-sm">
                      View logo
                    </a>
                  ) : null}
                  {viewRow.SignatureUrl ? (
                    <a href={viewRow.SignatureUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline text-sm">
                      View signature
                    </a>
                  ) : null}
                </div>
              </DetailCard>
            ) : null}
          </EntityDetailLayout>
        )}
      </FormDrawer>

      {showContractorAdminPanel && selectedContractor && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                Contractor Admin Users - {selectedContractor.contractorName}
              </span>

              <Button variant="outline" size="sm" onClick={closeContractorAdminPanel}>
                Back
              </Button>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <form onSubmit={saveContractorAdmin} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Username *</Label>
                <Input
                  value={contractorAdminForm.username}
                  autoComplete="off"
                  name={`contractor-admin-username-${selectedContractor.id}`}
                  onChange={(e) =>
                    setContractorAdminForm((p) => ({ ...p, username: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Password {editingContractorAdmin ? "(leave blank to keep old password)" : "*"}
                </Label>
                <Input
                  type="password"
                  value={contractorAdminForm.password}
                  autoComplete="new-password"
                  name={`contractor-admin-password-${selectedContractor.id}`}
                  placeholder={editingContractorAdmin ? "Leave blank to keep old password" : "Minimum 6 characters"}
                  onChange={(e) =>
                    setContractorAdminForm((p) => ({ ...p, password: e.target.value }))
                  }
                  required={!editingContractorAdmin}
                />
              </div>

              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  value={contractorAdminForm.firstName}
                  onChange={(e) =>
                    setContractorAdminForm((p) => ({ ...p, firstName: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  value={contractorAdminForm.lastName}
                  onChange={(e) =>
                    setContractorAdminForm((p) => ({ ...p, lastName: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Contact No</Label>
                <Input
                  value={contractorAdminForm.contactNo}
                  onChange={(e) =>
                    setContractorAdminForm((p) => ({ ...p, contactNo: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={contractorAdminForm.email}
                  onChange={(e) =>
                    setContractorAdminForm((p) => ({ ...p, email: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Input value={CONTRACTOR_ADMIN_ROLE} readOnly className="bg-gray-50" />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
                  <input
                    type="checkbox"
                    checked={contractorAdminForm.isActive}
                    onChange={(e) =>
                      setContractorAdminForm((p) => ({ ...p, isActive: e.target.checked }))
                    }
                  />
                  Active
                </label>
              </div>

              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" disabled={contractorAdminSaving}>
                  <Save className="w-4 h-4 mr-1" />
                  {contractorAdminSaving
                    ? editingContractorAdmin
                      ? "Updating..."
                      : "Creating..."
                    : editingContractorAdmin
                      ? "Update Contractor Admin"
                      : "Create Contractor Admin"}
                </Button>
              </div>
            </form>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {contractorAdmins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-gray-500">
                      No contractor admin users found for this contractor
                    </TableCell>
                  </TableRow>
                ) : (
                  contractorAdmins.map((admin) => (
                    <TableRow
                      key={admin.id}
                      className={editingContractorAdmin?.id === admin.id ? "bg-indigo-50" : ""}
                    >
                      <TableCell>{admin.username}</TableCell>

                      <TableCell>
                        <Badge variant="secondary">{admin.role}</Badge>
                      </TableCell>

                      <TableCell>
                        <Badge variant={admin.isActive ? "default" : "secondary"}>
                          {admin.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditContractorAdmin(admin)}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteContractorAdmin(admin.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {!isDialogOpen && !isViewDialogOpen && !showContractorAdminPanel && (<>
        <FilterBar
          search={{
            value: table.search,
            onChange: table.setSearch,
            placeholder: "Search contractors…",
          }}
          filters={
            <FilterSelect
              id="contractors-branch"
              value={branchFilter}
              onChange={setBranchFilter}
              options={branchFilterOptions}
              width="w-56"
              ariaLabel="Filter by branch"
            />
          }
        />

        <EntityListShell
          title="All contractors"
          columns={contractorColumns}
          rows={filtered}
          rowKey={(r) => String(r.id)}
          isLoading={loading}
          sortBy={table.sortBy}
          sortDir={table.sortDir}
          onSort={table.setSort}
          emptyIcon={Briefcase}
          emptyTitle="No contractors found"
          emptyDescription="Try adjusting your search or branch filter."
          emptyAction={
            canManage ? (
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Add Contractor
              </Button>
            ) : undefined
          }
        />
      </>)}
    </div>
  );
}