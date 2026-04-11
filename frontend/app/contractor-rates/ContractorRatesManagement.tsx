"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
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
import { Plus, Search, Trash2, IndianRupee } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { toast } from "sonner";

type ID = number;

interface ContractorRead {
  id: ID;
  serviceProviderID?: ID | null;
  companyID?: ID | null;
  contractorName?: string | null;
  serviceProvider?: { id: ID; companyName?: string | null } | null;
  company?: { id: ID; companyName?: string | null } | null;
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

const API = {
  contractors: "/backend/contractors",
  departments: "/backend/departments",
  designations: "/backend/designations",
  workShifts: "/backend/work-shift",
};

const MIN_CHARS = 1;
const DEBOUNCE_MS = 250;

async function fetchJSONSafe<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const raw = await res.json();
  return (raw?.data ?? raw) as T;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export function ContractorRatesManagement() {
  const user = useCurrentUser();
  const canManage = user?.role === "SUPERADMIN" || user?.role === "MANAGER";

  // Contractor selection
  const [contractors, setContractors] = useState<ContractorRead[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContractor, setSelectedContractor] = useState<ContractorRead | null>(null);
  const [isRateCardOpen, setIsRateCardOpen] = useState(false);

  // Contractor search autocomplete
  const [contrSearch, setContrSearch] = useState("");
  const [contrSuggestions, setContrSuggestions] = useState<ContractorRead[]>([]);
  const [contrLoading, setContrLoading] = useState(false);
  const contrRef = useRef<HTMLDivElement>(null);
  const contrAbortRef = useRef<AbortController | null>(null);
  const contrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rate card state
  const [rateCards, setRateCards] = useState<ContractorRateCard[]>([]);
  const [rcDepartments, setRcDepartments] = useState<{ id: number; departmentName: string }[]>([]);
  const [rcDesignations, setRcDesignations] = useState<{ id: number; designation: string; departmentID?: number }[]>([]);
  const [rcWorkShifts, setRcWorkShifts] = useState<{ id: number; workShiftName: string }[]>([]);

  // All rate cards for table display
  const [allRateCards, setAllRateCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Current user mapping for role-based filtering
  const [currentUserMapping, setCurrentUserMapping] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    if (user.role === "MANAGER") {
      fetch("/backend/users")
        .then((r) => r.json())
        .then((users) => {
          const me = users.find((u: any) => u.username === user.username);
          setCurrentUserMapping(me || null);
        })
        .catch(() => {});
    }
  }, [user]);

  // Load contractors
  useEffect(() => {
    if (!user) return;
    loadContractors();
  }, [user, currentUserMapping]);

  const loadContractors = async () => {
    setLoading(true);
    try {
      let data = await fetchJSONSafe<ContractorRead[]>(API.contractors);
      if (user?.role === "MANAGER" && currentUserMapping) {
        data = data.filter((c) => c.companyID === currentUserMapping.companyID);
      }
      setContractors(data);
      // Load all rate cards for display
      await loadAllRateCards(data);
    } catch (e) {
      console.error("Error loading contractors:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadAllRateCards = async (contractorsList: ContractorRead[]) => {
    try {
      const allCards: any[] = [];
      for (const contractor of contractorsList) {
        try {
          const cards = await fetchJSONSafe<any[]>(`${API.contractors}/${contractor.id}/rate-cards`);
          if (cards && cards.length > 0) {
            allCards.push(
              ...cards.map((c: any) => ({
                ...c,
                contractorId: contractor.id,
                contractorDisplayName: contractor.contractorName || "",
              }))
            );
          }
        } catch {
          // skip if no rate cards
        }
      }
      setAllRateCards(allCards);
    } catch {
      setAllRateCards([]);
    }
  };

  // Contractor search
  const runFetchContrSuggestions = (q: string) => {
    if (contrTimerRef.current) clearTimeout(contrTimerRef.current);
    contrTimerRef.current = setTimeout(async () => {
      contrAbortRef.current?.abort();
      const ctrl = new AbortController();
      contrAbortRef.current = ctrl;
      setContrLoading(true);
      try {
        let all = await fetchJSONSafe<ContractorRead[]>(API.contractors, ctrl.signal);
        if (user?.role === "MANAGER" && currentUserMapping) {
          all = all.filter((c) => c.companyID === currentUserMapping.companyID);
        }
        const ql = q.trim().toLowerCase();
        const filtered = ql.length >= MIN_CHARS
          ? all.filter((c) => (c.contractorName || "").toLowerCase().includes(ql))
          : all;
        setContrSuggestions(filtered.slice(0, 20));
      } catch (e) {
        if ((e as any)?.name !== "AbortError") console.error("Contractor fetch error:", e);
      } finally {
        setContrLoading(false);
      }
    }, DEBOUNCE_MS);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contrRef.current && !contrRef.current.contains(e.target as any)) {
        setContrSuggestions([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addRateCardRow = () => {
    setRateCards((prev) => [
      ...prev,
      {
        _localId: uid(),
        contractorName: selectedContractor?.contractorName || "",
        departmentName: "",
        designation: "",
        workShiftName: "",
        perMinuteRate: "",
        perHourRate: "",
        perDayRate: "",
        perMonthRate: "",
      },
    ]);
  };

  const updateRateCardRow = (localId: string, field: keyof Omit<ContractorRateCard, "_localId">, value: string) => {
    setRateCards((prev) => prev.map((r) => (r._localId === localId ? { ...r, [field]: value } : r)));
  };

  const removeRateCardRow = (localId: string) => {
    setRateCards((prev) => prev.filter((r) => r._localId !== localId));
  };

  const handleOpenRateCard = async (contractor: ContractorRead) => {
    setSelectedContractor(contractor);

    // Fetch departments, designations, and work shifts for dropdowns
    try {
      const [deptRes, desigRes, wsRes] = await Promise.all([
        fetchJSONSafe<any[]>(API.departments),
        fetchJSONSafe<any[]>(API.designations),
        fetchJSONSafe<any[]>(API.workShifts),
      ]);
      const cid = contractor.companyID;
      setRcDepartments((deptRes || []).filter((d: any) => !cid || d.companyID === cid));
      setRcDesignations((desigRes || []).filter((d: any) => !cid || d.companyID === cid));
      setRcWorkShifts((wsRes || []).filter((w: any) => !cid || w.companyID === cid));
    } catch {
      setRcDepartments([]);
      setRcDesignations([]);
      setRcWorkShifts([]);
    }

    try {
      const existing = await fetchJSONSafe<any[]>(`${API.contractors}/${contractor.id}/rate-cards`);
      if (existing && existing.length > 0) {
        setRateCards(
          existing.map((rc: any) => ({
            _localId: uid(),
            contractorName: rc.contractorName || contractor.contractorName || "",
            departmentName: rc.departmentName || "",
            designation: rc.designation || "",
            workShiftName: rc.workShiftName || "",
            perMinuteRate: rc.perMinuteRate?.toString() || "",
            perHourRate: rc.perHourRate?.toString() || "",
            perDayRate: rc.perDayRate?.toString() || "",
            perMonthRate: rc.perMonthRate?.toString() || "",
          }))
        );
      } else {
        setRateCards([
          {
            _localId: uid(),
            contractorName: contractor.contractorName || "",
            departmentName: "",
            designation: "",
            workShiftName: "",
            perMinuteRate: "",
            perHourRate: "",
            perDayRate: "",
            perMonthRate: "",
          },
        ]);
      }
    } catch {
      setRateCards([
        {
          _localId: uid(),
          contractorName: contractor.contractorName || "",
          departmentName: "",
          designation: "",
          workShiftName: "",
          perMinuteRate: "",
          perHourRate: "",
          perDayRate: "",
          perMonthRate: "",
        },
      ]);
    }
    setIsRateCardOpen(true);
  };

  const handleAddNew = async () => {
    setSelectedContractor(null);
    setContrSearch("");
    setRateCards([
      {
        _localId: uid(),
        contractorName: "",
        departmentName: "",
        designation: "",
        workShiftName: "",
        perMinuteRate: "",
        perHourRate: "",
        perDayRate: "",
        perMonthRate: "",
      },
    ]);
    // Fetch dropdowns
    try {
      const [deptRes, desigRes, wsRes] = await Promise.all([
        fetchJSONSafe<any[]>(API.departments),
        fetchJSONSafe<any[]>(API.designations),
        fetchJSONSafe<any[]>(API.workShifts),
      ]);
      setRcDepartments(deptRes || []);
      setRcDesignations(desigRes || []);
      setRcWorkShifts(wsRes || []);
    } catch {
      setRcDepartments([]);
      setRcDesignations([]);
      setRcWorkShifts([]);
    }
    setIsRateCardOpen(true);
  };

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto px-4">
      {/* Rate Card FormDrawer */}
      <FormDrawer
        open={isRateCardOpen}
        onOpenChange={setIsRateCardOpen}
        title={selectedContractor ? `Edit Rate Card — ${selectedContractor.contractorName || ""}` : "Add Contractor Rates"}
        description={selectedContractor ? "Update rate cards for this contractor." : "Select a contractor and define rate cards."}
      >
        <div className="space-y-4">
          {/* Contractor Name Selection */}
          <div ref={contrRef} className="relative">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Contractor Name *</label>
            <Input
              value={contrSearch}
              onChange={(e) => {
                setContrSearch(e.target.value);
                if (!selectedContractor || e.target.value !== selectedContractor.contractorName) {
                  runFetchContrSuggestions(e.target.value);
                }
              }}
              onFocus={() => {
                if (!selectedContractor) runFetchContrSuggestions(contrSearch);
              }}
              placeholder="Type contractor name to search..."
              autoComplete="off"
              disabled={!!selectedContractor}
            />
            {contrSuggestions.length > 0 && !selectedContractor && (
              <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto mt-1">
                {contrLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
                {contrSuggestions.map((c) => (
                  <div
                    key={c.id}
                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={async () => {
                      setContrSearch(c.contractorName || "");
                      setContrSuggestions([]);
                      setSelectedContractor(c);
                      // Update rate card rows with contractor name
                      setRateCards((prev) =>
                        prev.map((r) => ({ ...r, contractorName: c.contractorName || "" }))
                      );
                      // Filter dropdowns by company
                      const cid = c.companyID;
                      if (cid) {
                        setRcDepartments((prev) => prev.filter((d: any) => !d.companyID || d.companyID === cid));
                        setRcDesignations((prev) => prev.filter((d: any) => !d.companyID || d.companyID === cid));
                        setRcWorkShifts((prev) => prev.filter((w: any) => !w.companyID || w.companyID === cid));
                      }
                      // Load existing rate cards
                      try {
                        const existing = await fetchJSONSafe<any[]>(`${API.contractors}/${c.id}/rate-cards`);
                        if (existing && existing.length > 0) {
                          setRateCards(
                            existing.map((rc: any) => ({
                              _localId: uid(),
                              contractorName: rc.contractorName || c.contractorName || "",
                              departmentName: rc.departmentName || "",
                              designation: rc.designation || "",
                              workShiftName: rc.workShiftName || "",
                              perMinuteRate: rc.perMinuteRate?.toString() || "",
                              perHourRate: rc.perHourRate?.toString() || "",
                              perDayRate: rc.perDayRate?.toString() || "",
                              perMonthRate: rc.perMonthRate?.toString() || "",
                            }))
                          );
                        }
                      } catch {
                        // keep existing empty row
                      }
                    }}
                  >
                    {c.contractorName || `Contractor #${c.id}`}
                  </div>
                ))}
              </div>
            )}
            {selectedContractor && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-6 h-7 text-xs text-gray-500"
                onClick={() => {
                  setSelectedContractor(null);
                  setContrSearch("");
                  setRateCards([
                    {
                      _localId: uid(),
                      contractorName: "",
                      departmentName: "",
                      designation: "",
                      workShiftName: "",
                      perMinuteRate: "",
                      perHourRate: "",
                      perDayRate: "",
                      perMonthRate: "",
                    },
                  ]);
                }}
              >
                Change
              </Button>
            )}
          </div>

          {/* Rate Card Entries */}
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

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsRateCardOpen(false)}>Close</Button>
            <Button
              className=""
              disabled={!selectedContractor}
              onClick={async () => {
                if (!selectedContractor) {
                  toast.error("Please select a contractor first");
                  return;
                }
                try {
                  const payload = {
                    rateCards: rateCards.map((rc) => ({
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
                  const res = await fetch(`${API.contractors}/${selectedContractor.id}/rate-cards`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  });
                  if (!res.ok) throw new Error(await res.text());
                  setIsRateCardOpen(false);
                  toast.success("Rate card saved successfully");
                  await loadContractors();
                } catch (e: any) {
                  toast.error(e?.message || "Failed to save rate cards");
                }
              }}
            >
              Save Rate Card
            </Button>
          </div>
        </div>
      </FormDrawer>

      {!isRateCardOpen && (<>
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <p className="text-gray-600 mt-1 text-sm">Manage contractor rate cards</p>
        </div>
        <div className="flex items-center gap-3">
          {canManage && (
            <Button onClick={handleAddNew} className="flex-shrink-0 text-sm px-3 py-2">
              <Plus className="w-4 h-4 mr-1" />
              Add Contractor Rates
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4 w-full">
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
              {allRateCards.filter((rc) =>
                (rc.contractorDisplayName || rc.contractorName || "")
                  .toLowerCase()
                  .includes(searchTerm.toLowerCase())
              ).length} rate cards
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Contractor Rate Cards Table */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IndianRupee className="w-5 h-5" />
            Contractor Rate Cards
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Contractor Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Work Shift</TableHead>
                  <TableHead>Per Minute (₹)</TableHead>
                  <TableHead>Per Hour (₹)</TableHead>
                  <TableHead>Per Day (₹)</TableHead>
                  <TableHead>Per Month (₹)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allRateCards.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <IndianRupee className="w-12 h-12 text-gray-300" />
                        <p>No rate cards found</p>
                        <p className="text-sm">Click &quot;Add Contractor Rates&quot; to create one</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  allRateCards
                    .filter((rc) =>
                      (rc.contractorDisplayName || rc.contractorName || "")
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase())
                    )
                    .map((rc, index) => (
                      <TableRow key={`${rc.contractorId}-${index}`}>
                        <TableCell>{rc.contractorDisplayName || rc.contractorName || ""}</TableCell>
                        <TableCell>{rc.departmentName || "—"}</TableCell>
                        <TableCell>{rc.designation || "—"}</TableCell>
                        <TableCell>{rc.workShiftName || "—"}</TableCell>
                        <TableCell>{rc.perMinuteRate || "0"}</TableCell>
                        <TableCell>{rc.perHourRate || "0"}</TableCell>
                        <TableCell>{rc.perDayRate || "0"}</TableCell>
                        <TableCell>{rc.perMonthRate || "0"}</TableCell>
                        <TableCell className="text-right">
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const contractor = contractors.find((c) => c.id === rc.contractorId);
                                if (contractor) handleOpenRateCard(contractor);
                              }}
                              className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title="Edit Rate Card"
                            >
                              <IndianRupee className="w-3 h-3 mr-1" /> Edit
                            </Button>
                          )}
                        </TableCell>
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
