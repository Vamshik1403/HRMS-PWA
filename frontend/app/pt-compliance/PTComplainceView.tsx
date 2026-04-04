"use client";

import { useEffect, useState } from "react";
import { Pencil, Save, AlertTriangle, Building2, Users, PlusCircle, MapPin, Plus, Trash2 } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { Button } from "../components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

type Company = {
  id: number;
  companyName: string;
};

type Branch = {
  id: number;
  branchName: string;
  companyID: number;
  state?: string;
};

type PTSlab = {
  id?: number;
  slabName: string;
  monthlyGrossFrom: number;
  monthlyGrossTo: number;
  amount: number;
  applicableMonths: number[]; // Array of month numbers (1-12)
};

type PTCompliance = {
  id?: number;
  companyID: number;
  branchID: number;
  ptApplicable: boolean;
  state: string;
  maxPTPersonPerYear: number;
  monthlyDueDate: number;
  quarterlyDueDate: number;
  monthlyReturnThreshold: number;
  quarterlyReturnThreshold: number;
  ptslab: PTSlab[];
};

const MONTHS = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Apr" },
  { value: 5, label: "May" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Aug" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Oct" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dec" }
];

const DEFAULT_SLABS: PTSlab[] = [
  { 
    slabName: "Slab 1", 
    monthlyGrossFrom: 0, 
    monthlyGrossTo: 7500, 
    amount: 0, 
    applicableMonths: [1,2,3,4,5,6,7,8,9,10,11,12] 
  },
  { 
    slabName: "Slab 2", 
    monthlyGrossFrom: 7501, 
    monthlyGrossTo: 10000, 
    amount: 175,
    applicableMonths: [1,2,3,4,5,6,7,8,9,10,11,12]
  },
  { 
    slabName: "Slab 3", 
    monthlyGrossFrom: 10001, 
    monthlyGrossTo: 15000, 
    amount: 300,
    applicableMonths: [1,2,3,4,5,6,7,8,9,10,11,12]
  },
  { 
    slabName: "Slab 4", 
    monthlyGrossFrom: 15001, 
    monthlyGrossTo: 999999, 
    amount: 300,
    applicableMonths: [1,2,3,4,5,6,7,8,9,10,11,12]
  },
];

const DEFAULT_COMPLIANCE: Omit<PTCompliance, 'companyID' | 'branchID' | 'ptslab'> = {
  ptApplicable: false,
  state: 'Maharashtra',
  maxPTPersonPerYear: 2500,
  monthlyDueDate: 15,
  quarterlyDueDate: 15,
  monthlyReturnThreshold: 20,
  quarterlyReturnThreshold: 19,
};

export default function PTCompliancePage() {
  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
  const currentUser = useCurrentUser();
 const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [data, setData] = useState<PTCompliance | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [employeeCount, setEmployeeCount] = useState<number | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [slabs, setSlabs] = useState<PTSlab[]>(DEFAULT_SLABS);
  const [isInitialized, setIsInitialized] = useState(false);



  useEffect(() => {
    if (currentUser?.role === "SUPERADMIN") {
      fetchCompanies();
    } else if (currentUser?.role === "MANAGER") {
      // For MANAGER, first fetch all companies to get the full company list
      fetchCompanies().then(() => {
        if (currentUser.companyID) {
          // Create company object from user data
          const managerCompany: Company = {
            id: currentUser.companyID,
            companyName: currentUser.company?.companyName || "Company"
          };
          setSelectedCompany(managerCompany);
          
          // Fetch branches for this company
          fetchBranches(currentUser.companyID).then((fetchedBranches) => {
            if (currentUser.branchesID && fetchedBranches.length > 0) {
              // Find the specific branch from fetched branches
              const managerBranch = fetchedBranches.find((b: Branch) => b.id === currentUser.branchesID);
              if (managerBranch) {
                setSelectedBranch(managerBranch);
              }
            }
            setIsInitialized(true);
          });
        }
      });
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedCompany) {
      fetchEmployeeCount(selectedCompany.id);
    }
  }, [selectedCompany]);

  useEffect(() => {
    if (selectedCompany && selectedBranch) {
      fetchCompliance(selectedCompany.id, selectedBranch.id);
    }
  }, [selectedBranch]);

    const handleBack = () => {
    router.push('/branches');
  };


  const fetchCompanies = async () => {
    try {
      const res = await fetch(`${BACKEND}/company`);
      const data = await res.json();
      setCompanies(data);
      return data;
    } catch (error) {
      console.error("Error fetching companies:", error);
      return [];
    }
  };

  const fetchBranches = async (companyID: number) => {
    try {
      const res = await fetch(`${BACKEND}/branches?companyID=${companyID}`);
      if (res.ok) {
        const data = await res.json();
        const companyBranches = Array.isArray(data) 
          ? data.filter((b: Branch) => b.companyID === companyID)
          : [];
        setBranches(companyBranches);
        return companyBranches;
      } else {
        const allBranchesRes = await fetch(`${BACKEND}/branches`);
        if (allBranchesRes.ok) {
          const allBranches = await allBranchesRes.json();
          const filteredBranches = allBranches.filter((b: Branch) => b.companyID === companyID);
          setBranches(filteredBranches);
          return filteredBranches;
        }
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
      setBranches([]);
      return [];
    }
  };

  const fetchEmployeeCount = async (companyID: number) => {
    try {
      const res = await fetch(`${BACKEND}/manage-emp?companyID=${companyID}`);
      if (res.ok) {
        const employees = await res.json();
        
        const eligibleEmployees = employees.filter((emp: any) => {
          if (!emp.contractors) return true;
          return emp.contractors.contractorType !== "MSP";
        });
        
        setEmployeeCount(eligibleEmployees.length || 0);
      } else {
        setEmployeeCount(0);
      }
    } catch (error) {
      console.error("Error fetching employee count:", error);
      setEmployeeCount(0);
    }
  };

  const fetchCompliance = async (companyID: number, branchID: number) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND}/pt-compliance/${companyID}/${branchID}`);
      if (res.status === 404) {
        setData(null);
        setSlabs(DEFAULT_SLABS);
        setIsNewRecord(true);
        setEditMode(true);
      } else if (res.ok) {
        const json = await res.json();
        setData(json);
        setSlabs(json.ptslab || DEFAULT_SLABS);
        setIsNewRecord(false);
        setEditMode(false);
      }
    } catch (error) {
      console.error("Error fetching compliance:", error);
      setData(null);
      setSlabs(DEFAULT_SLABS);
      setIsNewRecord(true);
      setEditMode(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanyChange = (id: string) => {
    const company = companies.find(c => c.id === Number(id)) || null;
    setSelectedCompany(company);
    setSelectedBranch(null);
    setBranches([]);
    setData(null);
    setSlabs(DEFAULT_SLABS);
    setShowWarning(false);
    
    if (company) {
      fetchBranches(company.id);
    }
  };

  const handleBranchChange = (id: string) => {
    const branch = branches.find(b => b.id === Number(id)) || null;
    setSelectedBranch(branch);
  };

  const handleChange = (field: keyof PTCompliance, value: any) => {
    if (!data && selectedCompany && selectedBranch) {
      setData({
        companyID: selectedCompany.id,
        branchID: selectedBranch.id,
        ...DEFAULT_COMPLIANCE,
        ptslab: slabs,
        [field]: value
      });
    } else if (data) {
      setData({ ...data, [field]: value });
    }
  };

  const handleSlabChange = (index: number, field: keyof PTSlab, value: any) => {
    const updatedSlabs = [...slabs];
    updatedSlabs[index] = { ...updatedSlabs[index], [field]: value };
    setSlabs(updatedSlabs);
  };

  const handleMonthToggle = (slabIndex: number, month: number) => {
    const updatedSlabs = [...slabs];
    const slab = updatedSlabs[slabIndex];
    
    if (slab.applicableMonths.includes(month)) {
      slab.applicableMonths = slab.applicableMonths.filter(m => m !== month);
    } else {
      slab.applicableMonths = [...slab.applicableMonths, month].sort((a, b) => a - b);
    }
    
    setSlabs(updatedSlabs);
  };

  const handleSelectAllMonths = (slabIndex: number) => {
    const updatedSlabs = [...slabs];
    updatedSlabs[slabIndex].applicableMonths = [1,2,3,4,5,6,7,8,9,10,11,12];
    setSlabs(updatedSlabs);
  };

  const handleClearAllMonths = (slabIndex: number) => {
    const updatedSlabs = [...slabs];
    updatedSlabs[slabIndex].applicableMonths = [];
    setSlabs(updatedSlabs);
  };

  const addSlab = () => {
    const newSlab: PTSlab = {
      slabName: `Slab ${slabs.length + 1}`,
      monthlyGrossFrom: 0,
      monthlyGrossTo: 0,
      amount: 0,
      applicableMonths: [1,2,3,4,5,6,7,8,9,10,11,12],
    };
    setSlabs([...slabs, newSlab]);
  };

  const removeSlab = (index: number) => {
    setSlabs(slabs.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!selectedCompany || !selectedBranch) return;

    try {
      setIsLoading(true);
      
      const complianceData = {
        companyID: selectedCompany.id,
        branchID: selectedBranch.id,
        ptApplicable: data?.ptApplicable ?? DEFAULT_COMPLIANCE.ptApplicable,
        state: data?.state ?? DEFAULT_COMPLIANCE.state,
        maxPTPersonPerYear: data?.maxPTPersonPerYear ?? DEFAULT_COMPLIANCE.maxPTPersonPerYear,
        monthlyDueDate: data?.monthlyDueDate ?? DEFAULT_COMPLIANCE.monthlyDueDate,
        quarterlyDueDate: data?.quarterlyDueDate ?? DEFAULT_COMPLIANCE.quarterlyDueDate,
        monthlyReturnThreshold: data?.monthlyReturnThreshold ?? DEFAULT_COMPLIANCE.monthlyReturnThreshold,
        quarterlyReturnThreshold: data?.quarterlyReturnThreshold ?? DEFAULT_COMPLIANCE.quarterlyReturnThreshold,
        ptslab: slabs.map(slab => ({
          slabName: slab.slabName,
          monthlyGrossFrom: slab.monthlyGrossFrom,
          monthlyGrossTo: slab.monthlyGrossTo,
          amount: slab.amount,
          applicableMonths: slab.applicableMonths
        }))
      };

      console.log("Saving data:", complianceData);

      let response;
      
      if (isNewRecord || !data) {
        response = await fetch(`${BACKEND}/pt-compliance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(complianceData),
        });
      } else {
        response = await fetch(`${BACKEND}/pt-compliance/${data.companyID}/${data.branchID}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(complianceData),
        });
      }

      if (response.ok) {
        const savedData = await response.json();
        setData(savedData);
        setSlabs(savedData.ptslab || []);
        setEditMode(false);
        setIsNewRecord(false);
        setShowWarning(false);
      } else {
        const errorText = await response.text();
        console.error("Save failed:", errorText);
        alert(`Save failed: ${errorText}`);
      }
    } catch (error) {
      console.error("Error saving compliance:", error);
      alert("Error saving compliance. Check console for details.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (isNewRecord) {
      setData(null);
      setSlabs(DEFAULT_SLABS);
      setIsNewRecord(false);
      setEditMode(false);
    } else {
      if (selectedCompany && selectedBranch) {
        fetchCompliance(selectedCompany.id, selectedBranch.id);
      }
      setEditMode(false);
    }
    setShowWarning(false);
  };

  // Check if user is authorized
  if (!currentUser || (currentUser.role !== "SUPERADMIN" && currentUser.role !== "MANAGER")) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-red-800 mb-2">Access Denied</h2>
          <p className="text-red-600">{"You don't have permission to view this page."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">

    {/* Back Button */}
      <Button
        variant="ghost"
        onClick={handleBack}
        className="mb-2 -ml-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Branches
      </Button>
  
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">PT Compliance Management</h1>
        
        <div className="flex items-center gap-4">
          {currentUser?.role === "SUPERADMIN" && (
            <>
              <Building2 className="text-gray-400" size={20} />
              <select
                className="border rounded-lg px-4 py-2.5 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[250px]"
                value={selectedCompany?.id ?? ""}
                onChange={(e) => handleCompanyChange(e.target.value)}
              >
                <option value="">Select Company</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </>
          )}

          {currentUser?.role === "MANAGER" && selectedCompany && (
            <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg">
              <Building2 size={18} className="text-blue-600" />
              <span className="font-medium text-blue-800">{selectedCompany.companyName}</span>
              {currentUser.company?.companyName && (
                <span className="text-xs text-blue-600 ml-2">(Auto-selected)</span>
              )}
            </div>
          )}

          {selectedCompany && (
            <select
              className="border rounded-lg px-4 py-2.5 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[250px]"
              value={selectedBranch?.id ?? ""}
              onChange={(e) => handleBranchChange(e.target.value)}
              disabled={branches.length === 0}
            >
              <option value="">Select Branch</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.branchName} {b.state ? `(${b.state})` : ''}
                  {currentUser?.role === "MANAGER" && currentUser.branchesID === b.id ? ' (Your Branch)' : ''}
                </option>
              ))}
            </select>
          )}
          
          {selectedCompany && selectedBranch && isNewRecord && !isLoading && (
            <span className="text-blue-600 text-sm flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-full">
              <PlusCircle size={16} />
              New Branch - Configure and Save
            </span>
          )}
        </div>
      </div>

      {selectedCompany && selectedBranch && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column - Company & Branch Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Company Card */}
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b">
                <div className="flex items-center gap-2">
                  <Building2 size={18} className="text-blue-600" />
                  <h2 className="font-semibold text-gray-800">Company</h2>
                </div>
              </div>
              <div className="p-6">
                <p className="font-medium text-gray-900 text-lg">{selectedCompany.companyName}</p>
                {currentUser?.role === "MANAGER" && (
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                    Auto-selected from your profile
                  </p>
                )}
              </div>
            </div>

            {/* Branch Card */}
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b">
                <div className="flex items-center gap-2">
                  <MapPin size={18} className="text-green-600" />
                  <h2 className="font-semibold text-gray-800">Branch</h2>
                </div>
              </div>
              <div className="p-6">
                <p className="font-medium text-gray-900">{selectedBranch.branchName}</p>
                {selectedBranch.state && (
                  <p className="text-sm text-gray-600 mt-1">State: {selectedBranch.state}</p>
                )}
                {currentUser?.role === "MANAGER" && currentUser.branchesID === selectedBranch.id && (
                  <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                    <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                    Your assigned branch
                  </p>
                )}
              </div>
            </div>

            {/* Employee Statistics Card */}
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b">
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-green-600" />
                  <h2 className="font-semibold text-gray-800">Employee Statistics</h2>
                </div>
              </div>
              <div className="p-6">
                <div>
                  <label className="text-xs text-gray-500 uppercase">Total Employee Count</label>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">
                      {employeeCount ?? 0}
                    </span>
                    <span className="text-sm text-gray-500">(Auto fetch)</span>
                  </div>
                </div>
                
                <div className="mt-6 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">PT Applicable:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      data?.ptApplicable 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {data?.ptApplicable ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - PT Compliance Settings */}
          <div className="lg:col-span-3 space-y-6">
            {/* Header with Edit/Save/Cancel */}
            <div className="flex items-center justify-between bg-white p-4 rounded-lg border shadow-sm">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">PT Compliance Settings</h2>
                {isNewRecord && (
                  <p className="text-sm text-blue-600 mt-1">
                    No existing configuration found. Please configure and save.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {!editMode ? (
                  <button
                    onClick={() => setEditMode(true)}
                    disabled={isLoading}
                    className="flex items-center gap-2 border rounded-lg px-4 py-2.5 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    <Pencil size={18} /> Edit Settings
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleCancel}
                      disabled={isLoading}
                      className="flex items-center gap-2 border rounded-lg px-4 py-2.5 hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isLoading}
                      className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      <Save size={18} /> 
                      {isLoading ? 'Saving...' : isNewRecord ? 'Create Settings' : 'Save Changes'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="bg-white rounded-lg border p-12 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading compliance data...</p>
              </div>
            ) : (
              <>
                {/* PT Applicability */}
                <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                  <div className="bg-gray-50 px-6 py-4 border-b">
                    <h3 className="font-semibold text-gray-800">PT Applicability</h3>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-gray-700 min-w-[200px]">
                        PT Applicable:
                      </span>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={data?.ptApplicable ?? DEFAULT_COMPLIANCE.ptApplicable}
                          disabled={!editMode}
                          onChange={(e) => handleChange("ptApplicable", e.target.checked)}
                          className="w-5 h-5 rounded border-gray-300 text-blue-600"
                        />
                        <span className="text-sm text-gray-600">✓ PT is state-specific</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PT Slabs Table with Months */}
                <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                  <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
                    <h3 className="font-semibold text-gray-800">PT Slabs</h3>
                    {editMode && (
                      <button
                        onClick={addSlab}
                        className="flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
                      >
                        <Plus size={16} /> Add Slab
                      </button>
                    )}
                  </div>
                  <div className="p-6 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-2 text-left font-medium text-gray-600">Slab</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-600">Monthly Gross From (₹)</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-600">Monthly Gross To (₹)</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-600">Amount (₹)</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-600">Applicable Months</th>
                          {editMode && <th className="px-4 py-2 text-left font-medium text-gray-600">Action</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {slabs.map((slab, index) => (
                          <tr key={index} className="border-t">
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={slab.slabName}
                                disabled={!editMode}
                                onChange={(e) => handleSlabChange(index, "slabName", e.target.value)}
                                className="w-full border rounded px-2 py-1 disabled:bg-gray-50"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                value={slab.monthlyGrossFrom}
                                disabled={!editMode}
                                onChange={(e) => handleSlabChange(index, "monthlyGrossFrom", Number(e.target.value))}
                                className="w-full border rounded px-2 py-1 disabled:bg-gray-50"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                value={slab.monthlyGrossTo}
                                disabled={!editMode}
                                onChange={(e) => handleSlabChange(index, "monthlyGrossTo", Number(e.target.value))}
                                className="w-full border rounded px-2 py-1 disabled:bg-gray-50"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                value={slab.amount}
                                disabled={!editMode}
                                onChange={(e) => handleSlabChange(index, "amount", Number(e.target.value))}
                                className="w-full border rounded px-2 py-1 disabled:bg-gray-50"
                              />
                            </td>
                            <td className="px-4 py-3">
                              {editMode ? (
                                <div className="space-y-2 min-w-[200px]">
                                  <div className="flex gap-2 mb-2">
                                    <button
                                      type="button"
                                      onClick={() => handleSelectAllMonths(index)}
                                      className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                                    >
                                      All
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleClearAllMonths(index)}
                                      className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
                                    >
                                      Clear
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                                    {MONTHS.map(month => (
                                      <label key={month.value} className="flex items-center gap-1 text-xs">
                                        <input
                                          type="checkbox"
                                          checked={slab.applicableMonths.includes(month.value)}
                                          onChange={() => handleMonthToggle(index, month.value)}
                                          className="rounded border-gray-300 text-blue-600 w-3 h-3"
                                        />
                                        <span>{month.label}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {MONTHS.map(month => (
                                    <span
                                      key={month.value}
                                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${
                                        slab.applicableMonths.includes(month.value)
                                          ? 'bg-blue-100 text-blue-800'
                                          : 'bg-gray-100 text-gray-400'
                                      }`}
                                    >
                                      {month.label}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            {editMode && (
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => removeSlab(index)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-4 text-xs text-gray-500 space-y-1">
                      <p>• Slab-based (not percentage)</p>
                      <p>• Max ₹2,500/year per person</p>
                      <p>• Must deduct monthly</p>
                      <p>• Select months when this slab is applicable</p>
                    </div>
                  </div>
                </div>

                {/* Due Dates & Thresholds */}
                <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                  <div className="bg-gray-50 px-6 py-4 border-b">
                    <h3 className="font-semibold text-gray-800">Due Dates & Filing</h3>
                  </div>
                  <div className="p-6 space-y-6">
                    {/* Due Dates */}
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-gray-700 min-w-[200px]">
                        Due Dates:
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-600">Monthly:</span>
                        <input
                          type="number"
                          value={data?.monthlyDueDate ?? DEFAULT_COMPLIANCE.monthlyDueDate}
                          disabled={!editMode}
                          onChange={(e) => handleChange("monthlyDueDate", Number(e.target.value))}
                          className="border rounded-lg px-4 py-2.5 w-24 disabled:bg-gray-50"
                        />
                        <span className="text-gray-600">th</span>
                        <span className="text-gray-600 ml-4">Quarterly:</span>
                        <input
                          type="number"
                          value={data?.quarterlyDueDate ?? DEFAULT_COMPLIANCE.quarterlyDueDate}
                          disabled={!editMode}
                          onChange={(e) => handleChange("quarterlyDueDate", Number(e.target.value))}
                          className="border rounded-lg px-4 py-2.5 w-24 disabled:bg-gray-50"
                        />
                        <span className="text-gray-600">th of next month after quarter</span>
                      </div>
                    </div>

                    {/* Maximum PT per person per year */}
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-gray-700 min-w-[200px]">
                        Maximum PT per person per year:
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">₹</span>
                        <input
                          type="number"
                          value={data?.maxPTPersonPerYear ?? DEFAULT_COMPLIANCE.maxPTPersonPerYear}
                          disabled={!editMode}
                          onChange={(e) => handleChange("maxPTPersonPerYear", Number(e.target.value))}
                          className="border rounded-lg px-4 py-2.5 w-32 disabled:bg-gray-50"
                        />
                      </div>
                    </div>

                    {/* Return filing thresholds */}
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-gray-700 min-w-[200px]">
                        Monthly return if employee count ≥:
                      </span>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={data?.monthlyReturnThreshold ?? DEFAULT_COMPLIANCE.monthlyReturnThreshold}
                          disabled={!editMode}
                          onChange={(e) => handleChange("monthlyReturnThreshold", Number(e.target.value))}
                          className="border rounded-lg px-4 py-2.5 w-24 disabled:bg-gray-50"
                        />
                        <span className="text-sm text-gray-500">employees</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="font-medium text-gray-700 min-w-[200px]">
                        Quarterly return if &lt;:
                      </span>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={data?.quarterlyReturnThreshold ?? DEFAULT_COMPLIANCE.quarterlyReturnThreshold}
                          disabled={!editMode}
                          onChange={(e) => handleChange("quarterlyReturnThreshold", Number(e.target.value))}
                          className="border rounded-lg px-4 py-2.5 w-24 disabled:bg-gray-50"
                        />
                        <span className="text-sm text-gray-500">employees</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
                  <h4 className="font-semibold text-blue-800 mb-2">PT Rules Summary</h4>
                  <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                    <li>PT is state-specific - separate registration per state</li>
                    <li>Slab-based (not percentage)</li>
                    <li>Max ₹2,500/year per person</li>
                    <li>Must deduct monthly</li>
                    <li>Each slab can be configured for specific months</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {(!selectedCompany || !selectedBranch) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">No Selection</h2>
          <p className="text-yellow-700">
            {currentUser?.role === "MANAGER" 
              ? "Please select a branch to view PT compliance settings."
              : "Please select a company and branch to view PT compliance settings."}
          </p>
        </div>
      )}
    </div>
  );
}