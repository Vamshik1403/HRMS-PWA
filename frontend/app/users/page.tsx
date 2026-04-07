"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table"
import { Eye, EyeOff, Plus, Search, Trash2, Edit } from "lucide-react"
import { Icon } from "@iconify/react"
import { Badge } from "../components/ui/badge"
import { SearchSuggestInput } from "../components/SearchSuggestInput"

interface User {
  id: number
  username: string
  role: string
  isActive: boolean
  createdAt: string
  serviceProviderID?: number
  companyID?: number
  branchesID?: number
  serviceProvider?: { companyName: string }
  company?: { companyName: string }
  branches?: { branchName: string }
}

export default function UserManagement() {
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend"
  const USERS_API = `${BACKEND_URL}/users`
  const REGISTER_API = `${BACKEND_URL}/auth/register`

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  // Form state
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("MANAGER")
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)

  // 3-level linked selectors
  const [formData, setFormData] = useState({
    serviceProvider: "",
    companyName: "",
    branchName: "",
    serviceProviderID: undefined as number | undefined,
    companyID: undefined as number | undefined,
    branchesID: undefined as number | undefined,
  })

  // Fetch helpers
  async function robustGet<T = any>(url: string): Promise<T> {
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) throw new Error(`${res.status}`)
    return res.json()
  }

  const fetchServiceProviders = async (q: string) => {
    const data = await robustGet<any[]>(`${BACKEND_URL}/service-provider`)
    return data.filter((d) => (d.companyName || "").toLowerCase().includes(q.toLowerCase()))
  }

  const fetchCompanies = async (q: string) => {
    const data = await robustGet<any[]>(`${BACKEND_URL}/company`)
    return data.filter((d) => (d.companyName || "").toLowerCase().includes(q.toLowerCase()))
  }

  const fetchBranches = async (q: string) => {
    const data = await robustGet<any[]>(`${BACKEND_URL}/branches`)
    return data.filter((d) => (d.branchName || "").toLowerCase().includes(q.toLowerCase()))
  }

  // Fetch all users
  const fetchUsers = async () => {
    try {
      setLoading(true)
      const res = await fetch(USERS_API)
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : data.data ?? [])
    } catch (err: any) {
      setError(err.message || "Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const resetForm = () => {
    setUsername("")
    setPassword("")
    setRole("")
    setFormData({
      serviceProvider: "",
      companyName: "",
      branchName: "",
      serviceProviderID: undefined,
      companyID: undefined,
      branchesID: undefined,
    })
    setEditingUser(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (editingUser) {
        // UPDATE existing user
        const res = await fetch(`${USERS_API}/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            password: password || undefined,
            role,
            serviceProviderID: formData.serviceProviderID,
            companyID: formData.companyID,
            branchesID: formData.branchesID,
          }),
        })
        if (!res.ok) throw new Error(await res.text())
      } else {
        // CREATE new user
        const res = await fetch(REGISTER_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            password,
            role,
            serviceProviderID: formData.serviceProviderID,
            companyID: formData.companyID,
            branchesID: formData.branchesID,
          }),
        })
        if (!res.ok) throw new Error(await res.text())
      }

      await fetchUsers()
      resetForm()
      setIsDialogOpen(false)
    } catch (err: any) {
      setError(err.message || "Failed to save user")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (u: User) => {
    setEditingUser(u)
    setUsername(u.username)
    setPassword("") 
    setRole(u.role)
    setFormData({
      serviceProvider: u.serviceProvider?.companyName || "",
      companyName: u.company?.companyName || "",
      branchName: u.branches?.branchName || "",
      serviceProviderID: u.serviceProviderID,
      companyID: u.companyID,
      branchesID: u.branchesID,
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this user?")) return
    try {
      const res = await fetch(`${USERS_API}/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(await res.text())
      await fetchUsers()
    } catch (err: any) {
      alert(err.message || "Delete failed")
    }
  }

  const filtered = users.filter((u) => u.username.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto px-4" style={{ marginTop: "50px", marginLeft: "200px" }}>
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div>
          <p className="text-gray-600 mt-1 text-sm">Manage system user accounts</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                resetForm()
                setIsDialogOpen(true)
              }}
              className="bg-gray-900 hover:bg-gray-800 text-sm px-3 py-2"
            >
              <Plus className="w-4 h-4 mr-1" /> Register User
            </Button>
          </DialogTrigger>

          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingUser ? "Edit User" : "Register New User"}</DialogTitle>
              <DialogDescription>
                {editingUser ? "Update user details below." : "Fill in details to add a new user account."}
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">


              
              {/* Linked selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SearchSuggestInput
                  label="Service Provider"
                  placeholder="Select Service Provider"
                  value={formData.serviceProvider}
                  onChange={(v) => setFormData((p) => ({ ...p, serviceProvider: v }))}
                  onSelect={(s) => setFormData((p) => ({ ...p, serviceProvider: s.display, serviceProviderID: s.value }))}
                  fetchData={fetchServiceProviders}
                  displayField="companyName"
                  valueField="id"
                />
                <SearchSuggestInput
                  label="Company Name"
                  placeholder="Select Company"
                  value={formData.companyName}
                  onChange={(v) => setFormData((p) => ({ ...p, companyName: v }))}
                  onSelect={(s) => setFormData((p) => ({ ...p, companyName: s.display, companyID: s.value }))}
                  fetchData={fetchCompanies}
                  displayField="companyName"
                  valueField="id"
                />
                <SearchSuggestInput
                  label="Branch Name"
                  placeholder="Select Branch"
                  value={formData.branchName}
                  onChange={(v) => setFormData((p) => ({ ...p, branchName: v }))}
                  onSelect={(s) => setFormData((p) => ({ ...p, branchName: s.display, branchesID: s.value }))}
                  fetchData={fetchBranches}
                  displayField="branchName"
                  valueField="id"
                />
              </div>
              
              {/* Username */}
              <div className="space-y-2">
                <Label>Username *</Label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>

              {/* Password */}
              <div className="space-y-2 relative">
                <Label>{editingUser ? "New Password (leave blank to keep current)" : "Password *"}</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={!editingUser}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-500"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Role */}
              <div className="space-y-2">
                <Label>User Type *</Label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                 <option value="MANAGER">MANAGER</option>
                  <option value="SUPERADMIN">SUPERADMIN</option>
                </select>
              </div>


              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-gray-900 hover:bg-gray-800" disabled={saving}>
                  {saving ? "Saving..." : editingUser ? "Update User" : "Register User"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search bar */}
      <Card>
        <CardContent className="p-6 flex items-center space-x-4">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
          <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
            {filtered.length} users
          </Badge>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="mdi:account-multiple" className="w-5 h-5" /> User List
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0 w-full overflow-x-auto">
          {loading ? (
            <div className="p-6 text-sm text-gray-500">Loading…</div>
          ) : (
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Icon icon="mdi:account-search" className="w-12 h-12 text-gray-300" />
                        <p>No users found</p>
                        <p className="text-sm">Try adjusting your search</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>{u.username}</TableCell>
                      <TableCell>{u.role}</TableCell>
                      <TableCell>
                        <Badge
                          variant={u.isActive ? "default" : "secondary"}
                          className={u.isActive ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}
                        >
                          {u.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(u)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(u.id)}
                          className="text-red-600 hover:text-red-700"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
  )
}
