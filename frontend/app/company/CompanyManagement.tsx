"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Textarea } from "../components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Badge } from "../components/ui/badge"
import { Icon } from "@iconify/react"
import { Plus, Search, Edit, Trash2, Eye, ArrowLeft, X, Save, ChevronDown, FileText, Shield } from "lucide-react"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { useRouter } from "next/navigation"
import { FormDrawer } from "../components/ui/form-drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu"
import { SelectTrigger, SelectValue, SelectContent, SelectItem } from "@radix-ui/react-select"
import { Select } from "react-day-picker"
import { toast } from "sonner"
import { getSidebarContext } from "../utils/sidebarContext"

interface Company {
  id: number
  serviceProviderID?: number
  companyName?: string
  companyType?: string

  noticePeriodDaysForResignation?: string
  noticePeriodDaysForTermination?: string

  address?: string
  country?: string
  state?: string
  city?: string
  pincode?: string
  timeZone?: string
  currency?: string
  pfNo?: string
  tanNo?: string
  panNo?: string
  esiNo?: string
  linNo?: string
  gstNo?: string
  shopRegNo?: string
  shopRegCertHistory?: { certNo: string; effectFrom: string; _localId: string }[]
  financialYearStart?: string
  contactNo?: string
  emailAdd?: string
  companyLogoUrl?: string
  SignatureUrl?: string
  createdAt?: string
}

interface ServiceProvider {
  id: number
  companyName: string
}

export function CompanyManagement() {
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [viewCompany, setViewCompany] = useState<Company | null>(null)
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([])
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [signatureFile, setSignatureFile] = useState<File | null>(null)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [isViewing, setIsViewing] = useState(false)
  const user = useCurrentUser()
  const canManage = user?.role === "SUPERADMIN" || user?.role === "MANAGER" || user?.role === "COMPANY_ADMIN"

  interface CompanyFormData extends Partial<Company> {
    autocompleteName?: string
  }

  const [formData, setFormData] = useState<CompanyFormData>({
    companyName: "",
    companyType: "",
  
    noticePeriodDaysForResignation: "",
    noticePeriodDaysForTermination: "",

    address: "",
    country: "",
    state: "",
    city: "",
    pincode: "",
    timeZone: "",
    currency: "",
    pfNo: "",
    tanNo: "",
    panNo: "",
    esiNo: "",
    linNo: "",
    gstNo: "",
    shopRegNo: "",
    shopRegCertHistory: [] as { certNo: string; effectFrom: string; _localId: string }[],
    financialYearStart: "",
    contactNo: "",
    emailAdd: "",
    autocompleteName: "",
  })

  const wrapperRef = useRef<HTMLDivElement>(null)

  const [stagingShopReg, setStagingShopReg] = useState({ certNo: "", effectFrom: new Date().toISOString().slice(0, 10) });

  // Handle PF Compliance navigation
  const handlePFCompliance = () => {
    router.push('/pf-compliance')
  }

  // Handle ESIC Compliance navigation
  const handleESICCompliance = () => {
    router.push('/esic-compliance')
  }

  // Fetch companies based on role
  useEffect(() => {
    if (user) {
      fetchCompanies()
    }
  }, [user])

  const fetchCompanies = async () => {
    try {
      const res = await fetch("/backend/company")
      const json = await res.json()
      const all = Array.isArray(json) ? json : json.data ?? []

      if (user?.role === "SUPERADMIN") {
        setCompanies(all)
        return
      }

      if (user?.role === "MANAGER" || user?.role === "COMPANY_ADMIN") {
        const usersRes = await fetch("/backend/users")
        const users = await usersRes.json()
        const currentUser = users.find((u: any) => u.username === user.username)

        if (currentUser) {
          let filtered;
          if (currentUser.companyID) {
            filtered = all.filter(
              (c: any) =>
                c.id === currentUser.companyID ||
                c.branchesID === currentUser.branchesID
            )
          } else if (currentUser.serviceProviderID) {
            filtered = all.filter(
              (c: any) => c.serviceProviderID === currentUser.serviceProviderID
            )
          } else {
            filtered = []
          }
          setCompanies(filtered)
          return
        }
      }

      const credsRes = await fetch("/backend/manage-emp/credentials/all")
      const creds = await credsRes.json()
      const emp = creds.find((c: any) => c.username === user?.username)

      if (emp) {
        const filtered = all.filter(
          (c: any) =>
            c.id === emp.companyID ||
            c.branchesID === emp.branchesID
        )
        setCompanies(filtered)
      } else {
        setCompanies([])
      }
    } catch (error) {
      console.error("Failed to load companies:", error)
      setCompanies([])
    }
  }

  // Fetch service providers for autocomplete
  const fetchServiceProviders = async (query: string) => {
    try {
      const res = await fetch("/backend/service-provider")
      const data = await res.json()
      const filtered = data.filter((sp: ServiceProvider) =>
        sp.companyName.toLowerCase().includes(query.toLowerCase())
      )
      setServiceProviders(filtered)
    } catch (error) {
      console.error("Error fetching service providers:", error)
    }
  }

  useEffect(() => {
    if (formData.companyName && formData.companyName.length > 1) {
      fetchServiceProviders(formData.companyName)
    }
  }, [formData.companyName])

  const UPLOAD_URL = "/backend/files/upload";

  async function uploadImage(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(UPLOAD_URL, { method: "POST", body: fd });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const raw = await res.json();
    return raw?.url || raw?.data?.url || raw?.location || "";
  }

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let companyLogoUrl = formData.companyLogoUrl || "";
      let SignatureUrl = formData.SignatureUrl || "";

      if (logoFile) {
        companyLogoUrl = await uploadImage(logoFile);
      }
      if (signatureFile) {
        SignatureUrl = await uploadImage(signatureFile);
      }

      const { autocompleteName, id, ...formDataWithoutAutocomplete } = formData;
      const { serviceProvider, ...cleanFormData } = formDataWithoutAutocomplete as any;
      const finalData = {
        ...cleanFormData,
        companyName: formData.companyName || formData.autocompleteName || "",
        serviceProviderID: formData.serviceProviderID || undefined,
        companyLogoUrl: companyLogoUrl || undefined,
        SignatureUrl: SignatureUrl || undefined,
      };

      const res = editingCompany
        ? await fetch(`/backend/company/${editingCompany.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalData),
        })
        : await fetch("/backend/company", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalData),
        });

      if (!res.ok) throw new Error(await res.text());

      await fetchCompanies();
      resetForm();
      setIsAddingNew(false);
      setEditingCompany(null);
      toast.success("Company saved successfully");
      window.dispatchEvent(new Event("sidebar-refresh"));
    } catch (err) {
      console.error(err);
      toast.error((err as any)?.message || "Failed to save company");
    }
  };

  const handleEdit = (company: Company & { serviceProvider?: ServiceProvider }) => {
    setFormData({
      ...company,
      serviceProviderID: company.serviceProviderID,
      autocompleteName: company.serviceProvider?.companyName || "",
    })
    setEditingCompany(company)
    setIsAddingNew(true)
    setIsViewing(false)
  }

  const handleView = (company: Company) => {
    setViewCompany(company)
    setIsViewing(true)
    setIsAddingNew(false)
  }

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this company?")) {
      try {
        await fetch(`/backend/company/${id}`, { method: "DELETE" })
        await fetchCompanies()
        toast.success("Company deleted successfully")
      } catch (error) {
        console.error("Error deleting company:", error)
        toast.error((error as any)?.message || "Failed to delete company")
      }
    }
  }

  const resetForm = () => {
    const ctx = getSidebarContext();
    setFormData({
      companyName: "",
      companyType: "",
      noticePeriodDaysForResignation: "", 
      noticePeriodDaysForTermination: "",
      address: "",
      country: "",
      state: "",
      city: "",
      pincode: "",
      timeZone: "",
      currency: "",
      pfNo: "",
      tanNo: "",
      panNo: "",
      esiNo: "",
      linNo: "",
      gstNo: "",
      shopRegNo: "",
      shopRegCertHistory: [],
      financialYearStart: "",
      contactNo: "",
      emailAdd: "",
      serviceProviderID: ctx?.serviceProviderID ?? undefined,
      autocompleteName: ctx?.serviceProviderName ?? "",
    })
    setLogoFile(null)
    setSignatureFile(null)
    setEditingCompany(null)
  }

  const handleCancel = () => {
    resetForm()
    setIsAddingNew(false)
    setIsViewing(false)
    setViewCompany(null)
  }

  const handleBack = () => {
    router.push('/company')
  }

  const filteredCompanies = companies.filter(
    (c) =>
      c.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.country?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.emailAdd?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Close autocomplete on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setServiceProviders([])
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto px-4">
    
      {/* Header with Dropdown */}
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <p className="text-gray-600 mt-1 text-sm">Manage registered companies</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Compliance Dropdown */}
        
          {!isAddingNew && !isViewing && user?.role === "SUPERADMIN" && (
            <Button
              onClick={() => {
                resetForm()
                setIsAddingNew(true)
              }}
              className="text-sm px-3 py-2"
            >
              <Plus className="w-4 h-4 mr-1" /> Add Company
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
        onOpenChange={(v) => { if (!v) handleCancel(); }}
        title={editingCompany ? "Edit Company" : "Add New Company"}
      >
        <div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Company Name with Service Provider Autocomplete - auto-filled from sidebar */}
              <div ref={wrapperRef} className="space-y-2 relative hidden">
                <Label>Service Provider *</Label>
                <Input
                  value={formData.autocompleteName || ""}
                  onChange={(e) => {
                    const val = e.target.value
                    setFormData((p) => ({ ...p, autocompleteName: val }))
                    if (val.length > 1) fetchServiceProviders(val)
                    else setServiceProviders([])
                  }}
                  placeholder="Start typing service provider..."
                  autoComplete="off"
                />
                {serviceProviders.length > 0 && (
                  <div className="absolute z-10 bg-white border rounded w-full shadow max-h-40 overflow-y-auto">
                    {serviceProviders.map((sp) => (
                      <div
                        key={sp.id}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setFormData((p) => ({
                            ...p,
                            serviceProviderID: sp.id,
                            autocompleteName: sp.companyName,
                          }))
                          setServiceProviders([])
                        }}
                      >
                        {sp.companyName}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Company Name (Manual / Override)</Label>
                <Input
                  value={formData.companyName || ""}
                  onChange={(e) => setFormData((p) => ({ ...p, companyName: e.target.value }))}
                  placeholder="Enter company name manually"
                />
              </div>

              <div className="space-y-2">
                <Label>Company Type</Label>
                <div className="flex flex-wrap gap-3">
                  {["office", "shop", "factory"].map((type) => {
                    const selected = (formData.companyType || "").split(",").map(s => s.trim()).filter(Boolean);
                    const isChecked = selected.includes(type);
                    return (
                      <label key={type} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const current = (formData.companyType || "").split(",").map(s => s.trim()).filter(Boolean);
                            const updated = e.target.checked
                              ? [...current, type]
                              : current.filter(v => v !== type);
                            setFormData((p) => ({ ...p, companyType: updated.join(", ") }));
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
                <Label>Company Address</Label>
                <Textarea
                  value={formData.address || ""}
                  onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input value={formData.country || ""} onChange={(e) => setFormData((p) => ({ ...p, country: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input value={formData.state || ""} onChange={(e) => setFormData((p) => ({ ...p, state: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={formData.city || ""} onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Pincode</Label>
                  <Input value={formData.pincode || ""} onChange={(e) => setFormData((p) => ({ ...p, pincode: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Time Zone</Label>
                  <Input value={formData.timeZone || ""} onChange={(e) => setFormData((p) => ({ ...p, timeZone: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Input value={formData.currency || ""} onChange={(e) => setFormData((p) => ({ ...p, currency: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>PF No</Label><Input value={formData.pfNo || ""} onChange={(e) => setFormData((p) => ({ ...p, pfNo: e.target.value }))} /></div>
                <div className="space-y-2"><Label>TAN No</Label><Input value={formData.tanNo || ""} onChange={(e) => setFormData((p) => ({ ...p, tanNo: e.target.value }))} /></div>
                <div className="space-y-2"><Label>PAN No</Label><Input value={formData.panNo || ""} onChange={(e) => setFormData((p) => ({ ...p, panNo: e.target.value }))} /></div>
                <div className="space-y-2"><Label>ESI No</Label><Input value={formData.esiNo || ""} onChange={(e) => setFormData((p) => ({ ...p, esiNo: e.target.value }))} /></div>
                <div className="space-y-2"><Label>LIN No</Label><Input value={formData.linNo || ""} onChange={(e) => setFormData((p) => ({ ...p, linNo: e.target.value }))} /></div>
                <div className="space-y-2"><Label>GST No</Label><Input value={formData.gstNo || ""} onChange={(e) => setFormData((p) => ({ ...p, gstNo: e.target.value }))} /></div>
              </div>

              <div className="space-y-2">
                <Label>Shop Registration Certificate No</Label>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
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
                  <Button
                    type="button"
                    size="sm"
                    disabled={!stagingShopReg.certNo.trim()}
                    onClick={() => {
                      const entry = { certNo: stagingShopReg.certNo.trim(), effectFrom: stagingShopReg.effectFrom, _localId: Math.random().toString(36).slice(2, 10) };
                      setFormData((p) => ({
                        ...p,
                        shopRegCertHistory: [...(p.shopRegCertHistory || []), entry],
                        shopRegNo: entry.certNo,
                      }));
                      setStagingShopReg({ certNo: "", effectFrom: new Date().toISOString().slice(0, 10) });
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

              <div className="space-y-2">
                <Label>Financial Year Start</Label>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={formData.financialYearStart || ""}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, financialYearStart: e.target.value }))
                  }
                >
                  <option value="">-- Select Start Date --</option>
                  <option value="1st Jan">1st Jan</option>
                  <option value="1st April">1st April</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contact Number</Label>
                  <Input value={formData.contactNo || ""} onChange={(e) => setFormData((p) => ({ ...p, contactNo: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input type="email" value={formData.emailAdd || ""} onChange={(e) => setFormData((p) => ({ ...p, emailAdd: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Company Logo</Label>
                <Input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
              </div>
              <div className="space-y-2">
                <Label>Signature Upload</Label>
                <Input type="file" accept="image/*" onChange={(e) => setSignatureFile(e.target.files?.[0] || null)} />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCancel}>
                  BACK
                </Button>
                <Button type="submit" className="">
                  <Save className="w-4 h-4 mr-1" />
                  {editingCompany ? "Update Company" : "Add Company"}
                </Button>
              </div>
            </form>
        </div>
      </FormDrawer>

      {/* View Details - Drawer */}
      <FormDrawer
        open={!!(isViewing && viewCompany)}
        onOpenChange={(v) => { if (!v) handleCancel(); }}
        title="Company Details"
      >
        {viewCompany && (
        <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><strong>Name:</strong> {viewCompany.companyName}</div>
              <div><strong>Type:</strong> {viewCompany.companyType}</div>

              <div><strong>Address:</strong> {viewCompany.address}</div>
              <div><strong>Country:</strong> {viewCompany.country}</div>
              <div><strong>State:</strong> {viewCompany.state}</div>
              <div><strong>City:</strong> {viewCompany.city || "—"}</div>
              <div><strong>Pincode:</strong> {viewCompany.pincode || "—"}</div>
              <div><strong>GST No:</strong> {viewCompany.gstNo}</div>
              <div><strong>Contact:</strong> {viewCompany.contactNo}</div>
              <div><strong>Email:</strong> {viewCompany.emailAdd}</div>
              <div><strong>Currency:</strong> {viewCompany.currency}</div>
              <div><strong>TimeZone:</strong> {viewCompany.timeZone}</div>
              <div><strong>PF:</strong> {viewCompany.pfNo}</div>
              <div><strong>TAN:</strong> {viewCompany.tanNo}</div>
              <div><strong>PAN:</strong> {viewCompany.panNo}</div>
              <div><strong>ESI:</strong> {viewCompany.esiNo}</div>
              <div><strong>LIN:</strong> {viewCompany.linNo}</div>
              <div><strong>Shop Reg:</strong> {viewCompany.shopRegNo}
                {(viewCompany as any).shopRegCertHistory && Array.isArray((viewCompany as any).shopRegCertHistory) && (viewCompany as any).shopRegCertHistory.length > 0 && (
                  <div className="mt-1 text-xs text-gray-500">
                    {(viewCompany as any).shopRegCertHistory.map((h: any, i: number) => (
                      <div key={i}>{h.certNo} — WEF {h.effectFrom || "—"}</div>
                    ))}
                  </div>
                )}
              </div>
              <div><strong>FY Start:</strong> {viewCompany.financialYearStart}</div>
            </div>
            <div className="flex gap-4 mt-4">
              {viewCompany.companyLogoUrl && (
                <div>
                  <strong>Logo:</strong>
                  <img src={viewCompany.companyLogoUrl} alt="Company Logo" className="w-24 h-24 object-contain border rounded" />
                </div>
              )}
              {viewCompany.SignatureUrl && (
                <div>
                  <strong>Signature:</strong>
                  <img src={viewCompany.SignatureUrl} alt="Signature" className="w-24 h-24 object-contain border rounded" />
                </div>
              )}
            </div>
        </div>
        )}
      </FormDrawer>

      {!isAddingNew && !isViewing && (<>
          <Card>
            <CardContent className="p-6 flex items-center space-x-4">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search companies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
              <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
                {filteredCompanies.length} companies
              </Badge>
            </CardContent>
          </Card>

          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon icon="mdi:office-building" className="w-5 h-5" /> Company List
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 w-full overflow-x-auto">
              <Table className="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>GST</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        <div className="flex flex-col items-center gap-2">
                          <Icon icon="mdi:account-search" className="w-12 h-12 text-gray-300" />
                          <p>No companies found</p>
                          <p className="text-sm">Try adjusting your search criteria</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCompanies.map((company) => (
                      <TableRow key={company.id}>
                        <TableCell>{company.companyName}</TableCell>
                        <TableCell>{company.country}</TableCell>
                        <TableCell>{company.state}</TableCell>
                        <TableCell>{company.emailAdd}</TableCell>
                        <TableCell>{company.contactNo}</TableCell>
                        <TableCell>{company.gstNo}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleView(company)}
                              className="h-7 w-7 p-0"
                            >
                              <Eye className="w-3 h-3" />
                            </Button>

                            {(user?.role === "SUPERADMIN" || user?.role === "MANAGER" || user?.role === "COMPANY_ADMIN") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(company)}
                                className="h-7 w-7 p-0"
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                            )}

                            {user?.role === "SUPERADMIN" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(company.id)}
                                className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
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
            </CardContent>
          </Card>
      </>)}
    </div>
  )
}