"use client"

import { useState, useEffect } from "react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Plus, X } from "lucide-react"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { getSidebarContext } from "../utils/sidebarContext"

interface IntegrationRow {
  id: number
  company: string
  provider: string
  apiUrl: string
  apiKey?: string
  token?: string
}

interface Company {
  id: number
  companyName?: string
}

const PROVIDERS = ["GreytHR", "Eve"]

export function HRMSIntegrationsManagement() {
  const user = useCurrentUser()
  const isAdmin = user?.role === "ADMIN"

  const [rows, setRows] = useState<IntegrationRow[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [modalOpen, setModalOpen] = useState(false)

  const [form, setForm] = useState({
    companyID: "",
    provider: "GreytHR",
    apiUrl: "",
    apiKey: "",
    pemFile: null as File | null,
    bearerToken: "",
  })

  // Fetch companies for the dropdown
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await fetch("/backend/company")
        const data = await res.json()
        const all: Company[] = Array.isArray(data) ? data : data?.data ?? []
        if (isAdmin && user?.companyID) {
          setCompanies(all.filter((c) => c.id === user.companyID))
        } else {
          const ctx = getSidebarContext()
          if (ctx?.companyID) {
            setCompanies(all.filter((c) => c.id === ctx.companyID))
          } else {
            setCompanies(all)
          }
        }
      } catch {
        setCompanies([])
      }
    }
    if (user) fetchCompanies()
  }, [user])

  const resetForm = () => {
    setForm({ companyID: "", provider: "GreytHR", apiUrl: "", apiKey: "", pemFile: null, bearerToken: "" })
  }

  const handleOpenModal = () => {
    resetForm()
    // Pre-select company if only one available
    if (companies.length === 1) {
      setForm((p) => ({ ...p, companyID: String(companies[0].id) }))
    }
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    resetForm()
    setModalOpen(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const selectedCompany = companies.find((c) => String(c.id) === form.companyID)
    const newRow: IntegrationRow = {
      id: Date.now(),
      company: selectedCompany?.companyName ?? "—",
      provider: form.provider,
      apiUrl: form.apiUrl,
      apiKey: form.provider === "GreytHR" ? form.apiKey : undefined,
      token: form.provider === "Eve" ? form.bearerToken : undefined,
    }
    setRows((prev) => [...prev, newRow])
    handleCloseModal()
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <p className="text-gray-600 text-sm">Manage HRMS integrations and connected services</p>
        <Button onClick={handleOpenModal} className="text-sm px-3 py-2">
          <Plus className="w-4 h-4 mr-1" /> Add API
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="px-4 py-3 text-left font-semibold">COMPANY</th>
              <th className="px-4 py-3 text-left font-semibold">PROVIDER</th>
              <th className="px-4 py-3 text-left font-semibold">API URL</th>
              <th className="px-4 py-3 text-left font-semibold">API KEY</th>
              <th className="px-4 py-3 text-left font-semibold">TOKEN</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-400 text-sm">
                  No integrations configured yet. Click &quot;Add API&quot; to get started.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">{row.company}</td>
                  <td className="px-4 py-3">{row.provider}</td>
                  <td className="px-4 py-3 max-w-xs truncate" title={row.apiUrl}>{row.apiUrl || "—"}</td>
                  <td className="px-4 py-3 max-w-xs truncate" title={row.apiKey}>{row.apiKey || "N/A"}</td>
                  <td className="px-4 py-3 max-w-xs truncate" title={row.token}>{row.token || "N/A"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="text-blue-500">🔗</span> Add HRMS API
              </h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Row 1: Company + Provider */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company</Label>
                  <select
                    className="w-full px-3 py-2 border rounded-md bg-white text-sm"
                    value={form.companyID}
                    onChange={(e) => setForm((p) => ({ ...p, companyID: e.target.value }))}
                    required
                  >
                    <option value="">Select company…</option>
                    {companies.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.companyName || `Company #${c.id}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Provider Name</Label>
                  <select
                    className="w-full px-3 py-2 border rounded-md bg-white text-sm"
                    value={form.provider}
                    onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value, apiKey: "", pemFile: null, bearerToken: "" }))}
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: API URL + conditional second field */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>API URL</Label>
                  <Input
                    value={form.apiUrl}
                    onChange={(e) => setForm((p) => ({ ...p, apiUrl: e.target.value }))}
                    placeholder="Enter API URL"
                  />
                </div>

                {form.provider === "GreytHR" && (
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <Input
                      value={form.apiKey}
                      onChange={(e) => setForm((p) => ({ ...p, apiKey: e.target.value }))}
                      placeholder="Enter API Key"
                    />
                  </div>
                )}

                {form.provider === "Eve" && (
                  <div className="space-y-2">
                    <Label>Authorization Token (Bearer)</Label>
                    <Input
                      value={form.bearerToken}
                      onChange={(e) => setForm((p) => ({ ...p, bearerToken: e.target.value }))}
                      placeholder="Enter Bearer Token"
                    />
                  </div>
                )}
              </div>

              {/* GreytHR: PEM File */}
              {form.provider === "GreytHR" && (
                <div className="space-y-2">
                  <Label>PEM File</Label>
                  <input
                    type="file"
                    accept=".pem,.crt,.key"
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-gray-300 file:text-sm file:bg-white file:text-gray-700 hover:file:bg-gray-50"
                    onChange={(e) => setForm((p) => ({ ...p, pemFile: e.target.files?.[0] ?? null }))}
                  />
                </div>
              )}

              {/* Info hint */}
              <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 text-sm text-teal-800">
                {form.provider === "GreytHR" && (
                  <><span className="font-semibold">GreytHR:</span> Requires URL + API Key + PEM file and sends signed swipes.</>
                )}
                {form.provider === "Eve" && (
                  <><span className="font-semibold">Eve:</span> Requires URL + Bearer Token and sends JSON payload.</>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  <X className="w-4 h-4 mr-1" /> Cancel
                </Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white">
                  ✓ Add API
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
