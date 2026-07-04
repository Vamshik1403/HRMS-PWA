"use client";

import { useEffect, useState } from "react";
import { Pencil, Save, AlertTriangle, Building2, Users, PlusCircle } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { getSidebarContext } from "../utils/sidebarContext";
import { useRouter } from "next/navigation"
import { Button } from "../components/ui/button"
import { NoticeBanner } from "../components/ui/notice-banner"
import {  ArrowLeft, X, ChevronDown, FileText, Shield } from "lucide-react"


type Company = {
  id: number;
  companyName: string;
  pfNo?: string;
  esiNo?: string;
  panNo?: string;
  gstNo?: string;
};

type CurrentUser = {
  role: string;
  companyID?: number;
  company?: {
    companyName: string;
    pfNo?: string;
    esiNo?: string;
    panNo?: string;
    gstNo?: string;
  };
};

type PFCompliance = {
  companyID: number;
  epfThresholdCount: number;
  epfApplicable: boolean;
  wageCeiling: number;
  basicValidationPercent: number;
  compulsoryForAll: boolean;
  employeeRate: number;
  employerRate: number;
  epsRate: number;
  edliRate: number;
  adminChargeRate: number;
  edliMax: number;
  adminChargeMax: number;
  dueDate: number;
};

const DEFAULT_COMPLIANCE: Omit<PFCompliance, 'companyID'> = {
  epfThresholdCount: 20,
  epfApplicable: false,
  wageCeiling: 15000,
  basicValidationPercent: 40,
  compulsoryForAll: false,
  employeeRate: 12,
  employerRate: 12,
  epsRate: 8.33,
  edliRate: 0.5,
  adminChargeRate: 0.01,
  edliMax: 75,
  adminChargeMax: 2,
  dueDate: 15,
};

export default function PFCompliancePage() {
  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";
  const currentUser = useCurrentUser();
    const router = useRouter()
  

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [data, setData] = useState<PFCompliance | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [employeeCount, setEmployeeCount] = useState<number | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initial load based on user role
  useEffect(() => {
    if (currentUser?.role === "SUPERADMIN") {
      fetchCompanies();
    } else if (currentUser?.role === "SERVICE_PROVIDER") {
      fetchCompanies().then((allCompanies) => {
        const ctx = getSidebarContext();
        if (ctx?.companyID) {
          const company = allCompanies?.find((c: any) => c.id === ctx.companyID);
          if (company) {
            setSelectedCompany(company);
            fetchCompliance(ctx.companyID);
            fetchEmployeeCount(ctx.companyID);
          }
        } else if (currentUser.serviceProviderID && allCompanies) {
          const spCompanies = allCompanies.filter((c: any) => c.serviceProviderID === currentUser.serviceProviderID);
          setCompanies(spCompanies);
        }
        setIsInitialized(true);
      });
    }
  }, [currentUser]);

  // Fetch employee count when company changes
  useEffect(() => {
    if (selectedCompany) {
      fetchEmployeeCount(selectedCompany.id);
    }
  }, [selectedCompany]);

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

    const handleBackToCompany = () => {
    router.push('/company')
  }

  const fetchEmployeeCount = async (companyID: number) => {
    try {
      const res = await fetch(`${BACKEND}/manage-emp`);
      if (res.ok) {
        const allEmployees = await res.json();
        
        const companyEmployees = allEmployees.filter((emp: any) => 
          emp.companyID === companyID
        );
        
        const eligibleEmployees = companyEmployees.filter((emp: any) => {
          if (!emp.contractors) return true;
          return emp.contractors.contractorType !== "MSP";
        });
        
        setEmployeeCount(eligibleEmployees.length || 0);
      }
    } catch (error) {
      console.error("Error fetching employee count:", error);
      setEmployeeCount(0);
    }
  };

  const fetchCompliance = async (companyID: number) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND}/pf-compliance/${companyID}`);
      if (res.status === 404) {
        setData(null);
        setIsNewRecord(true);
        setEditMode(true);
      } else if (res.ok) {
        const json = await res.json();
        setData(json);
        setIsNewRecord(false);
        setEditMode(false);
      }
    } catch {
      setData(null);
      setIsNewRecord(true);
      setEditMode(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanyChange = (id: string) => {
    const company = companies.find(c => c.id === Number(id)) || null;
    setSelectedCompany(company);
    if (company) {
      fetchCompliance(company.id);
      fetchEmployeeCount(company.id);
    }
    setShowWarning(false);
  };

  const handleChange = (field: keyof PFCompliance, value: any) => {
    if (!data && selectedCompany) {
      setData({
        companyID: selectedCompany.id,
        ...DEFAULT_COMPLIANCE,
        [field]: value
      });
    } else if (data) {
      setData({ ...data, [field]: value });
    }
    
    if (field === "epfApplicable" && value === false && employeeCount && employeeCount >= 20) {
      setShowWarning(true);
    } else if (field === "epfApplicable" && value === true) {
      setShowWarning(false);
    }
  };

  const handleSave = async () => {
    if (!selectedCompany) return;

    try {
      setIsLoading(true);
      
      const complianceData = data || {
        companyID: selectedCompany.id,
        ...DEFAULT_COMPLIANCE
      };

      let response;
      
      if (isNewRecord || !data) {
        response = await fetch(`${BACKEND}/pf-compliance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(complianceData),
        });
      } else {
        response = await fetch(`${BACKEND}/pf-compliance/${data.companyID}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      }

      if (response.ok) {
        await fetchCompliance(selectedCompany.id);
        setEditMode(false);
        setIsNewRecord(false);
        setShowWarning(false);
      }
    } catch (error) {
      console.error("Error saving compliance:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (isNewRecord) {
      setData(null);
      setIsNewRecord(false);
      setEditMode(false);
    } else {
      if (selectedCompany) {
        fetchCompliance(selectedCompany.id);
      }
      setEditMode(false);
    }
    setShowWarning(false);
  };

  // Check if user is authorized
  if (!currentUser || (currentUser.role !== "SUPERADMIN" && currentUser.role !== "SERVICE_PROVIDER")) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-red-800 mb-2">Access Denied</h2>
          <p className="text-red-600">{"You don't have permission to view this page."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">

        {/* Back Button */}
      <Button
        variant="ghost"
        onClick={handleBackToCompany}
        className="mb-2 -ml-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Companies
      </Button>

      {/* Header Section */}
      <div className="flex items-center justify-end flex-wrap gap-4">
        <div className="flex items-center gap-4">
          {currentUser?.role === "SUPERADMIN" ? (
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
          ) : (
            currentUser?.role === "SERVICE_PROVIDER" && selectedCompany && (
              <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg">
                <Building2 size={18} className="text-blue-600" />
                <span className="font-medium text-blue-800">{selectedCompany.companyName}</span>
                {currentUser.company?.companyName && (
                  <span className="text-xs text-blue-600 ml-2">(Auto-selected)</span>
                )}
              </div>
            )
          )}
          
          {selectedCompany && isNewRecord && !isLoading && (
            <span className="text-blue-600 text-sm flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-full">
              <PlusCircle size={16} />
              New Company - Configure and Save
            </span>
          )}
        </div>
      </div>

      {selectedCompany && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column - Company & Employee Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Company Card */}
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b">
                <div className="flex items-center gap-2">
                  <Building2 size={18} className="text-blue-600" />
                  <h2 className="font-semibold text-gray-800">Company Details</h2>
                </div>
              </div>
              <div className="p-6">
                <div className="mb-4">
                  <label className="text-xs text-gray-500 uppercase">Company Name</label>
                  <p className="font-medium text-gray-900 text-lg">{selectedCompany.companyName}</p>
                  {currentUser?.role === "SERVICE_PROVIDER" && (
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                      Auto-selected from your profile
                    </p>
                  )}
                </div>
                
                <div className="space-y-2 pt-2 border-t">
                  {selectedCompany.pfNo && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">PF No.:</span>
                      <span className="text-sm font-medium">{selectedCompany.pfNo}</span>
                    </div>
                  )}
                  {selectedCompany.esiNo && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">ESI No.:</span>
                      <span className="text-sm font-medium">{selectedCompany.esiNo}</span>
                    </div>
                  )}
                </div>
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
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Total Employee Count</label>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-gray-900">
                        {employeeCount ?? 0}
                      </span>
                      <span className="text-sm text-gray-500">(Auto fetch)</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Excluding MSP contractor employees
                    </p>
                  </div>
                </div>
                
                <div className="mt-6 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">EPF Applicable:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      data?.epfApplicable 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {data?.epfApplicable ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - PF Compliance Settings */}
          <div className="lg:col-span-3 space-y-6">
            {/* Header with Edit/Save/Cancel */}
            <div className="flex items-center justify-between bg-white p-4 rounded-lg border shadow-sm">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">PF Compliance Settings</h2>
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
                      className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
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
                {/* EPF Threshold & Applicability */}
                <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                  <div className="bg-gray-50 px-6 py-4 border-b">
                    <h3 className="font-semibold text-gray-800">EPF Eligibility</h3>
                  </div>
                  <div className="p-6 space-y-6">
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-gray-700 min-w-[280px]">
                        EPF Minimum Employee count threshold value:
                      </span>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={data?.epfThresholdCount ?? DEFAULT_COMPLIANCE.epfThresholdCount}
                          disabled={!editMode}
                          onChange={(e) => handleChange("epfThresholdCount", Number(e.target.value))}
                          className="border rounded-lg px-4 py-2.5 w-32 disabled:bg-gray-50"
                        />
                        <span className="text-sm text-gray-500">employees</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="font-medium text-gray-700 min-w-[280px]">
                        EPF Applicable:
                      </span>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={data?.epfApplicable ?? DEFAULT_COMPLIANCE.epfApplicable}
                          disabled={!editMode}
                          onChange={(e) => handleChange("epfApplicable", e.target.checked)}
                          className="w-5 h-5 rounded border-gray-300 text-blue-600"
                        />
                        {showWarning && (
                          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                            <AlertTriangle size={16} />
                            <span className="text-sm">PF should be applicable when employee count is 20 or more</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="font-medium text-gray-700 min-w-[280px]">
                        EPF Compulsory for All Employees:
                      </span>
                      <input
                        type="checkbox"
                        checked={data?.compulsoryForAll ?? DEFAULT_COMPLIANCE.compulsoryForAll}
                        disabled={!editMode}
                        onChange={(e) => handleChange("compulsoryForAll", e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 text-blue-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Statutory PF Wages Section */}
                <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                  <div className="bg-gray-50 px-6 py-4 border-b">
                    <h3 className="font-semibold text-gray-800">Wage & Salary Settings</h3>
                  </div>
                  <div className="p-6 space-y-6">
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-gray-700 min-w-[280px]">
                        Statutory PF Wages Ceiling (Basic + DA) ≤:
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">₹</span>
                        <input
                          type="number"
                          value={data?.wageCeiling ?? DEFAULT_COMPLIANCE.wageCeiling}
                          disabled={!editMode}
                          onChange={(e) => handleChange("wageCeiling", Number(e.target.value))}
                          className="border rounded-lg px-4 py-2.5 w-32 disabled:bg-gray-50"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="font-medium text-gray-700 min-w-[280px]">
                        Basic Salary Validation (Basic + DA):
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-600">Not Below</span>
                        <input
                          type="number"
                          value={data?.basicValidationPercent ?? DEFAULT_COMPLIANCE.basicValidationPercent}
                          disabled={!editMode}
                          onChange={(e) => handleChange("basicValidationPercent", Number(e.target.value))}
                          className="border rounded-lg px-4 py-2.5 w-24 disabled:bg-gray-50"
                        />
                        <span className="text-gray-600">% of Gross Wages/Salary</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PF Rates Section */}
                <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                  <div className="bg-gray-50 px-6 py-4 border-b">
                    <h3 className="font-semibold text-gray-800">PF Rates (Compliance)</h3>
                  </div>
                  <div className="p-6 space-y-6">
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-gray-700 min-w-[280px]">
                        Employee Deductions:
                      </span>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={data?.employeeRate ?? DEFAULT_COMPLIANCE.employeeRate}
                          disabled={!editMode}
                          onChange={(e) => handleChange("employeeRate", Number(e.target.value))}
                          className="border rounded-lg px-4 py-2.5 w-24 disabled:bg-gray-50"
                        />
                        <span className="text-gray-600">% of Basic + DA or Wages Ceiling</span>
                        <span className="text-sm text-gray-500 ml-2">(12% Default)</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="font-medium text-gray-700 min-w-[280px]">
                        Total Employer Contributions:
                      </span>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={data?.employerRate ?? DEFAULT_COMPLIANCE.employerRate}
                          disabled={!editMode}
                          onChange={(e) => handleChange("employerRate", Number(e.target.value))}
                          className="border rounded-lg px-4 py-2.5 w-24 disabled:bg-gray-50"
                        />
                        <span className="text-gray-600">% of Basic + DA or Wages Ceiling</span>
                        <span className="text-sm text-gray-500 ml-2">(12% Default)</span>
                      </div>
                    </div>

                    <div className="ml-8 space-y-6">
                      <div className="flex items-center gap-4">
                        <span className="font-medium text-gray-700 min-w-[260px]">
                          → Employer EPS Contribution:
                        </span>
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            value={data?.epsRate ?? DEFAULT_COMPLIANCE.epsRate}
                            disabled={!editMode}
                            onChange={(e) => handleChange("epsRate", Number(e.target.value))}
                            className="border rounded-lg px-4 py-2.5 w-24 disabled:bg-gray-50"
                          />
                          <span className="text-gray-600">% of Basic + DA or Wages Ceiling</span>
                          <span className="text-sm text-gray-500 ml-2">(8.33% Default)</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="font-medium text-gray-700 min-w-[260px]">
                          → Employer EPF Contribution:
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-600">Balance</span>
                          <span className="text-gray-800 font-medium">
                            ({(data?.employerRate ?? DEFAULT_COMPLIANCE.employerRate)}% - {(data?.epsRate ?? DEFAULT_COMPLIANCE.epsRate)}% = {' '}
                            {((data?.employerRate ?? DEFAULT_COMPLIANCE.employerRate) - 
                              (data?.epsRate ?? DEFAULT_COMPLIANCE.epsRate)).toFixed(2)}%)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 ml-6">
                        <span className="font-medium text-gray-700 min-w-[240px]">
                          EDLI:
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-600">Of Min. Wages Or</span>
                          <input
                            type="number"
                            value={data?.edliRate ?? DEFAULT_COMPLIANCE.edliRate}
                            disabled={!editMode}
                            onChange={(e) => handleChange("edliRate", Number(e.target.value))}
                            className="border rounded-lg px-4 py-2.5 w-24 disabled:bg-gray-50"
                          />
                          <span className="text-gray-600">%</span>
                          <span className="text-sm text-gray-500 ml-2">
                            (0.50% Default, Max ₹{data?.edliMax ?? DEFAULT_COMPLIANCE.edliMax})
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-4">
                      <span className="font-medium text-gray-700 min-w-[280px]">
                        Admin Charges:
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-600">Of Min. Wages Or</span>
                        <input
                          type="number"
                          value={data?.adminChargeRate ?? DEFAULT_COMPLIANCE.adminChargeRate}
                          disabled={!editMode}
                          onChange={(e) => handleChange("adminChargeRate", Number(e.target.value))}
                          className="border rounded-lg px-4 py-2.5 w-24 disabled:bg-gray-50"
                        />
                        <span className="text-gray-600">%</span>
                        <span className="text-sm text-gray-500 ml-2">
                          (0.01% Default, Max ₹{data?.adminChargeMax ?? DEFAULT_COMPLIANCE.adminChargeMax})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Due Date Section */}
                <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                  <div className="bg-gray-50 px-6 py-4 border-b">
                    <h3 className="font-semibold text-gray-800">Payment Schedule</h3>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-gray-700 min-w-[280px]">
                        Due Date of EPF Payment:
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-600">Day</span>
                        <input
                          type="number"
                          value={data?.dueDate ?? DEFAULT_COMPLIANCE.dueDate}
                          disabled={!editMode}
                          onChange={(e) => handleChange("dueDate", Number(e.target.value))}
                          className="border rounded-lg px-4 py-2.5 w-24 disabled:bg-gray-50"
                        />
                        <span className="text-gray-600">of Next Month</span>
                        <span className="text-sm text-gray-500 ml-2">(15th Default)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
                  <h4 className="font-semibold text-blue-800 mb-2">PF Rules Summary</h4>
                  <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                    <li>Applicable if employee count ≥ {data?.epfThresholdCount || 20}</li>
                    <li>Wage ceiling: ₹{data?.wageCeiling || 15000}</li>
                    <li>Employee contribution: {data?.employeeRate || 12}% of Basic + DA</li>
                    <li>Employer contribution: {data?.employerRate || 12}% (EPS: {data?.epsRate || 8.33}%, EPF: {((data?.employerRate ?? DEFAULT_COMPLIANCE.employerRate) - (data?.epsRate ?? DEFAULT_COMPLIANCE.epsRate)).toFixed(2)}%)</li>
                    <li>Due date: {data?.dueDate || 15}th of next month</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {!selectedCompany && (
        <NoticeBanner
          variant="warning"
          centered
          title="No company selected"
          description={
            currentUser?.role === "SERVICE_PROVIDER"
              ? "No company is assigned to your profile. Please contact an administrator."
              : "Please select a company to view PF compliance settings."
          }
        />
      )}
    </div>
  );
}