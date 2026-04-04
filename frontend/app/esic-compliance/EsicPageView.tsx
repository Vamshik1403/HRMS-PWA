"use client";

import { useEffect, useState } from "react";
import { Pencil, Save, AlertTriangle, Building2, Users, PlusCircle } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { Button } from "../components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
type Company = {
  id: number;
  companyName: string;
  esiNo?: string;
};

type ESICCompliance = {
  companyID: number;
  esicThresholdCount: number;
  esicApplicable: boolean;
  wageCeiling: number;
  disabledWageCeiling: number;
  employeeRate: number;
  employerRate: number;
  dueDate: number;
};

const DEFAULT_COMPLIANCE: Omit<ESICCompliance, 'companyID'> = {
  esicThresholdCount: 10,
  esicApplicable: false,
  wageCeiling: 21000,
  disabledWageCeiling: 25000,
  employeeRate: 0.75,
  employerRate: 3.25,
  dueDate: 15,
};

export default function ESICCompliancePage() {
  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
  const currentUser = useCurrentUser();
  const router = useRouter()

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [data, setData] = useState<ESICCompliance | null>(null);
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
    } else if (currentUser?.role === "MANAGER") {
      // For MANAGER, fetch companies and auto-select their company
      fetchCompanies().then(() => {
        if (currentUser.companyID) {
          // Create company object from user data
          const managerCompany: Company = {
            id: currentUser.companyID,
            companyName: currentUser.company?.companyName || "Company",
          };
          setSelectedCompany(managerCompany);
          
          // Fetch compliance and employee data for this company
          fetchCompliance(currentUser.companyID);
          fetchEmployeeCount(currentUser.companyID);
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


    const handleBackToCompany = () => {
    router.push('/company')
  }

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
      const res = await fetch(`${BACKEND}/esic-compliance/${companyID}`);
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

  const handleChange = (field: keyof ESICCompliance, value: any) => {
    if (!data && selectedCompany) {
      setData({
        companyID: selectedCompany.id,
        ...DEFAULT_COMPLIANCE,
        [field]: value
      });
    } else if (data) {
      setData({ ...data, [field]: value });
    }
    
    if (field === "esicApplicable" && value === false && employeeCount && employeeCount >= 10) {
      setShowWarning(true);
    } else if (field === "esicApplicable" && value === true) {
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
        response = await fetch(`${BACKEND}/esic-compliance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(complianceData),
        });
      } else {
        response = await fetch(`${BACKEND}/esic-compliance/${data.companyID}`, {
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
  if (!currentUser || (currentUser.role !== "SUPERADMIN" && currentUser.role !== "MANAGER")) {
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">ESIC Compliance Management</h1>
        
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
            currentUser?.role === "MANAGER" && selectedCompany && (
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
                  {currentUser?.role === "MANAGER" && (
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                      Auto-selected from your profile
                    </p>
                  )}
                </div>
                
                <div className="space-y-2 pt-2 border-t">
                  {selectedCompany.esiNo ? (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">ESI No.:</span>
                      <span className="text-sm font-medium">{selectedCompany.esiNo}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">ESI No.:</span>
                      <span className="text-sm text-gray-400">Not registered</span>
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
                
                <div className="mt-6 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">ESIC Applicable:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      data?.esicApplicable 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {data?.esicApplicable ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - ESIC Compliance Settings */}
          <div className="lg:col-span-3 space-y-6">
            {/* Header with Edit/Save/Cancel */}
            <div className="flex items-center justify-between bg-white p-4 rounded-lg border shadow-sm">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">ESIC Compliance Settings</h2>
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
                {/* ESIC Threshold & Applicability */}
                <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                  <div className="bg-gray-50 px-6 py-4 border-b">
                    <h3 className="font-semibold text-gray-800">ESIC Eligibility</h3>
                  </div>
                  <div className="p-6 space-y-6">
                    {/* ESIC Minimum Employee count threshold value */}
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-gray-700 min-w-[280px]">
                        ESIC Minimum Employee count threshold value:
                      </span>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={data?.esicThresholdCount ?? DEFAULT_COMPLIANCE.esicThresholdCount}
                          disabled={!editMode}
                          onChange={(e) => handleChange("esicThresholdCount", Number(e.target.value))}
                          className="border rounded-lg px-4 py-2.5 w-32 disabled:bg-gray-50"
                        />
                        <span className="text-sm text-gray-500">employees</span>
                      </div>
                    </div>

                    {/* ESIC Applicable */}
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-gray-700 min-w-[280px]">
                        ESIC Applicable:
                      </span>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={data?.esicApplicable ?? DEFAULT_COMPLIANCE.esicApplicable}
                          disabled={!editMode}
                          onChange={(e) => handleChange("esicApplicable", e.target.checked)}
                          className="w-5 h-5 rounded border-gray-300 text-blue-600"
                        />
                        {showWarning && (
                          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                            <AlertTriangle size={16} />
                            <span className="text-sm">ESIC should be applicable when employee count is 10 or more</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Wage Ceiling Section */}
                <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                  <div className="bg-gray-50 px-6 py-4 border-b">
                    <h3 className="font-semibold text-gray-800">Wage Ceiling Settings</h3>
                  </div>
                  <div className="p-6 space-y-6">
                    {/* Employee gross monthly wage ≤ */}
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-gray-700 min-w-[280px]">
                        Employee gross monthly wage ≤:
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
                        <span className="text-sm text-gray-500 ml-2">(Default: ₹21,000)</span>
                      </div>
                    </div>

                    {/* For employees with disability */}
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-gray-700 min-w-[280px]">
                        For employees with disability:
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">₹</span>
                        <input
                          type="number"
                          value={data?.disabledWageCeiling ?? DEFAULT_COMPLIANCE.disabledWageCeiling}
                          disabled={!editMode}
                          onChange={(e) => handleChange("disabledWageCeiling", Number(e.target.value))}
                          className="border rounded-lg px-4 py-2.5 w-32 disabled:bg-gray-50"
                        />
                        <span className="text-sm text-gray-500 ml-2">(Default: ₹25,000)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contribution Rates Section */}
                <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                  <div className="bg-gray-50 px-6 py-4 border-b">
                    <h3 className="font-semibold text-gray-800">Contribution Rates</h3>
                  </div>
                  <div className="p-6 space-y-6">
                    {/* Employee Contribution */}
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-gray-700 min-w-[280px]">
                        Employee:
                      </span>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          step="0.01"
                          value={data?.employeeRate ?? DEFAULT_COMPLIANCE.employeeRate}
                          disabled={!editMode}
                          onChange={(e) => handleChange("employeeRate", Number(e.target.value))}
                          className="border rounded-lg px-4 py-2.5 w-24 disabled:bg-gray-50"
                        />
                        <span className="text-gray-600">% of Gross Salary</span>
                        <span className="text-sm text-gray-500 ml-2">(0.75% Default)</span>
                      </div>
                    </div>

                    {/* Employer Contribution */}
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-gray-700 min-w-[280px]">
                        Employer:
                      </span>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          step="0.01"
                          value={data?.employerRate ?? DEFAULT_COMPLIANCE.employerRate}
                          disabled={!editMode}
                          onChange={(e) => handleChange("employerRate", Number(e.target.value))}
                          className="border rounded-lg px-4 py-2.5 w-24 disabled:bg-gray-50"
                        />
                        <span className="text-gray-600">% of Gross Salary</span>
                        <span className="text-sm text-gray-500 ml-2">(3.25% Default)</span>
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
                        Due Date of ESIC Payment:
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
                  <h4 className="font-semibold text-blue-800 mb-2">ESIC Rules Summary</h4>
                  <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                    <li>Applicable if employee count ≥ {data?.esicThresholdCount || 10}</li>
                    <li>Wage ceiling: ₹{data?.wageCeiling || 21000} (₹{data?.disabledWageCeiling || 25000} for disabled employees)</li>
                    <li>Employee contribution: {data?.employeeRate || 0.75}% of gross salary</li>
                    <li>Employer contribution: {data?.employerRate || 3.25}% of gross salary</li>
                    <li>Due date: {data?.dueDate || 15}th of next month</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {!selectedCompany && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">No Company Selected</h2>
          <p className="text-yellow-700">
            {currentUser?.role === "MANAGER" 
              ? "No company is assigned to your profile. Please contact an administrator."
              : "Please select a company to view ESIC compliance settings."}
          </p>
        </div>
      )}
    </div>
  );
}