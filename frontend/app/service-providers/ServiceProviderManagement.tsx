"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { PageHeader } from "../components/app/page-header"
import { Textarea } from "../components/ui/textarea"
import { FormDrawer } from "../components/ui/form-drawer"
import { DetailCard } from "../components/app/detail-card"
import { EntityDetailHero, EntityDetailLayout } from "../components/app/entity-detail-layout"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table"
import { Badge } from "../components/ui/badge"
import { Icon } from "@iconify/react"
import { Plus, Search, Edit, Trash2, Eye, ArrowLeft, EyeOff, UserPlus, Building2 } from "lucide-react"
import { toast } from "sonner"

interface ServiceProvider {
  id: number
  companyName: string
  companyAddress: string
  country: string
  state: string
  city: string
  pincode: string
  countryCode: string
  gstNo: string
  contactNo: string
  emailAdd: string
  website: string
  companyLogoUrl: string
  createdAt: string
}

export function ServiceProviderManagement() {
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<ServiceProvider | null>(null)
  const [viewProvider, setViewProvider] = useState<ServiceProvider | null>(null)

  const [isUserDrawerOpen, setIsUserDrawerOpen] = useState(false)
  const [selectedProviderForUser, setSelectedProviderForUser] = useState<ServiceProvider | null>(null)
  const [savingUser, setSavingUser] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [spUsers, setSpUsers] = useState<any[]>([])
  const [loadingSpUsers, setLoadingSpUsers] = useState(false)
  const [showCreateUserForm, setShowCreateUserForm] = useState(false)
const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false)
const [editingSpUser, setEditingSpUser] = useState<any | null>(null)

  const [userForm, setUserForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    password: "",
    role: "SERVICE_PROVIDER",
    serviceProviderID: "" as string | number,
    companyID: "",
    branchesID: "",
    isActive: true,
  })

  const [formData, setFormData] = useState({
    companyName: "",
    companyAddress: "",
    country: "",
    state: "",
    city: "",
    pincode: "",
    countryCode: "",
    gstNo: "",
    contactNo: "",
    emailAdd: "",
    website: "",
    companyLogoUrl: "",
  })

  // 🔹 Fetch providers on load
  useEffect(() => {
    fetchProviders()
  }, [])

  const fetchProviders = async () => {
    try {
      const res = await fetch("/backend/service-provider")
      const data = await res.json()
      setServiceProviders(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching service providers:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    const validationErrors: string[] = []
    if (!formData.companyName?.trim()) validationErrors.push("Company Name is required")
    if (validationErrors.length > 0) {
      validationErrors.forEach(msg => toast.error(msg))
      return
    }

    try {

      let res
      if (editingProvider) {
        res = await fetch(`/backend/service-provider/${editingProvider.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        })
      } else {
        res = await fetch("/backend/service-provider", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        })
      }

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Request failed: ${res.status} - ${errText}`)
      }

      await fetchProviders()
      resetForm()
      setIsDialogOpen(false)
      toast.success("Service provider saved successfully")
      window.dispatchEvent(new Event("sidebar-refresh"))
    } catch (error) {
      console.error("Error saving service provider:", error)
      toast.error((error as any)?.message || "Failed to save service provider")
    }
  }


  const fetchServiceProviderUsers = async (providerId: number) => {
    try {
      setLoadingSpUsers(true)

      const res = await fetch("/backend/users")
      if (!res.ok) throw new Error("Failed to load users")

      const data = await res.json()
      const rows = Array.isArray(data) ? data : []

      setSpUsers(
        rows.filter(
          (u) =>
            Number(u.serviceProviderID) === Number(providerId) &&
            String(u.role || "").toUpperCase() === "SERVICE_PROVIDER"
        )
      )
    } catch (error) {
      console.error("Error loading service provider users:", error)
      toast.error("Failed to load service provider users")
      setSpUsers([])
    } finally {
      setLoadingSpUsers(false)
    }
  }

  const openCreateUserDrawer = async (provider: ServiceProvider) => {
    setSelectedProviderForUser(provider)
    setIsUserDrawerOpen(true)
setIsCreateUserModalOpen(false)
setEditingSpUser(null)

    setUserForm({
      firstName: "",
      lastName: "",
      username: "",
      password: "",
      role: "SERVICE_PROVIDER",
      serviceProviderID: provider.id,
      companyID: "",
      branchesID: "",
      isActive: true,
    })

    setShowPassword(false)
    setShowCreateUserForm(false)

    await fetchServiceProviderUsers(provider.id)
  }

  const closeCreateUserDrawer = () => {
    setIsUserDrawerOpen(false)
    setSelectedProviderForUser(null)
    setShowPassword(false)
    setShowCreateUserForm(false)
setIsCreateUserModalOpen(false)
setEditingSpUser(null)
    setSpUsers([])

    setUserForm({
      firstName: "",
      lastName: "",
      username: "",
      password: "",
      role: "SERVICE_PROVIDER",
      serviceProviderID: "",
      companyID: "",
      branchesID: "",
      isActive: true,
    })
  }

  const closeServiceProviderUserPanel = () => {
    closeCreateUserDrawer()
  }

  const handleEditServiceProviderUser = (u: any) => {
  setEditingSpUser(u)
  setUserForm({
    firstName: u.firstName || "",
    lastName: u.lastName || "",
    username: u.username || "",
    password: "",
    role: "SERVICE_PROVIDER",
    serviceProviderID: u.serviceProviderID || selectedProviderForUser?.id || "",
    companyID: "",
    branchesID: "",
    isActive: !!u.isActive,
  })
  setShowPassword(false)
  setIsCreateUserModalOpen(true)
}

const handleDeleteServiceProviderUser = async (userId: number) => {
  if (!confirm("Are you sure you want to delete this service provider user?")) return

  try {
    const res = await fetch(`/backend/users/${userId}`, {
      method: "DELETE",
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(errText || "Failed to delete user")
    }

    toast.success("User deleted successfully")

    if (selectedProviderForUser) {
      await fetchServiceProviderUsers(selectedProviderForUser.id)
    }
  } catch (error: any) {
    toast.error(error?.message || "Failed to delete user")
  }
}

  const handleCreateServiceProviderUser = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedProviderForUser?.id) {
      toast.error("Service provider is not selected")
      return
    }

    if (!userForm.username.trim()) {
      toast.error("Username is required")
      return
    }

 if (!editingSpUser && !userForm.password.trim()) {
  toast.error("Password is required")
  return
}

    setSavingUser(true)

    try {
 const payload: any = {
  firstName: userForm.firstName?.trim() || null,
  lastName: userForm.lastName?.trim() || null,
  username: userForm.username.trim(),
  role: "SERVICE_PROVIDER",
  serviceProviderID: Number(selectedProviderForUser?.id),
  isActive: userForm.isActive,
}

if (userForm.password.trim()) {
  payload.password = userForm.password
}

const res = await fetch(
  editingSpUser ? `/backend/users/${editingSpUser.id}` : "/backend/users",
  {
    method: editingSpUser ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }
)

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(errText || "Failed to create service provider user")
      }

toast.success(editingSpUser ? "Service provider user updated successfully" : "Service provider user created successfully")

      setUserForm({
        firstName: "",
        lastName: "",
        username: "",
        password: "",
        role: "SERVICE_PROVIDER",
        serviceProviderID: selectedProviderForUser?.id ?? "",
        companyID: "",
        branchesID: "",
        isActive: true,
      })

      setShowPassword(false)
      setShowCreateUserForm(false)
      setIsCreateUserModalOpen(false)
      setEditingSpUser(null)

      if (selectedProviderForUser) {
        await fetchServiceProviderUsers(selectedProviderForUser.id)
      }
    } catch (error: any) {
      console.error("Error creating service provider user:", error)
      toast.error(error?.message || "Failed to create service provider user")
    } finally {
      setSavingUser(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this service provider?")) {
      try {
        await fetch(`/backend/service-provider/${id}`, {
          method: "DELETE",
        })
        await fetchProviders()
        toast.success("Service provider deleted successfully")
      } catch (error) {
        console.error("Error deleting service provider:", error)
        toast.error((error as any)?.message || "Failed to delete service provider")
      }
    }
  }

  const handleEdit = (provider: ServiceProvider) => {
    setFormData({
      companyName: provider.companyName,
      companyAddress: provider.companyAddress,
      country: provider.country,
      state: provider.state,
      city: provider.city || "",
      pincode: provider.pincode || "",
      countryCode: provider.countryCode || "",
      gstNo: provider.gstNo,
      contactNo: provider.contactNo,
      emailAdd: provider.emailAdd,
      website: provider.website,
      companyLogoUrl: provider.companyLogoUrl,
    })
    setEditingProvider(provider)
    setIsDialogOpen(true)
  }

  const handleView = (provider: ServiceProvider) => {
    setViewProvider(provider)
    setIsViewDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({
      companyName: "",
      companyAddress: "",
      country: "",
      state: "",
      city: "",
      pincode: "",
      countryCode: "",
      gstNo: "",
      contactNo: "",
      emailAdd: "",
      website: "",
      companyLogoUrl: "",
    })
    setEditingProvider(null)
  }

  const filteredProviders = serviceProviders.filter(
    (provider) =>
      provider.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      provider.emailAdd.toLowerCase().includes(searchTerm.toLowerCase()) ||
      provider.country.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={Building2}
        title="Service Providers"
        description="Manage your service provider relationships"
        actions={
  !isDialogOpen && !isUserDrawerOpen ? (
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />
              Add Service Provider
            </Button>
          ) : null
        }
      />

      {/* Add/Edit Drawer */}
      <FormDrawer
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={editingProvider ? "Edit Service Provider" : "Add New Service Provider"}
        description={editingProvider
          ? "Update the service provider information below."
          : "Fill in the details to add a new service provider."}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name *</Label>
            <Input
              id="companyName"
              value={formData.companyName}

              onChange={(e) => setFormData((prev) => ({ ...prev, companyName: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyAddress">Company Address *</Label>
            <Textarea
              id="companyAddress"
              value={formData.companyAddress}
              onChange={(e) => setFormData((prev) => ({ ...prev, companyAddress: e.target.value }))}
              rows={3}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country">Country *</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State *</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pincode">Pincode</Label>
              <Input
                id="pincode"
                value={formData.pincode}
                onChange={(e) => setFormData((prev) => ({ ...prev, pincode: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gstNo">GST No *</Label>
            <Input
              id="gstNo"
              value={formData.gstNo}
              onChange={(e) => setFormData((prev) => ({ ...prev, gstNo: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactNo">Contact Number *</Label>
              <div className="flex gap-2">
                <Input
                  id="countryCode"
                  value={formData.countryCode}
                  onChange={(e) => setFormData((prev) => ({ ...prev, countryCode: e.target.value }))}
                  placeholder="+91"
                  className="w-20 shrink-0"
                />
                <Input
                  id="contactNo"
                  value={formData.contactNo}
                  onChange={(e) => setFormData((prev) => ({ ...prev, contactNo: e.target.value }))}
                  required
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="emailAdd">Email Address *</Label>
              <Input
                id="emailAdd"
                type="email"
                value={formData.emailAdd}
                onChange={(e) => setFormData((prev) => ({ ...prev, emailAdd: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={formData.website}
              onChange={(e) => setFormData((prev) => ({ ...prev, website: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">

            <Button type="submit">
              {editingProvider ? "Update Provider" : "Add Provider"}
            </Button>
          </div>
        </form>
      </FormDrawer>

      {/* View Drawer */}
      <FormDrawer
        open={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
        title="Service Provider Details"
        showHeaderCancel
        cancelLabel="Close"
      >
        {viewProvider && (
          <EntityDetailLayout
            hero={
              <EntityDetailHero
                title={viewProvider.companyName}
                subtitle={<span>{viewProvider.city || viewProvider.state}, {viewProvider.country}</span>}
              />
            }
          >
            <DetailCard
              title="Overview"
              subtitle="Core service provider details"
              rows={[
                { label: "Company name", value: viewProvider.companyName },
                { label: "Address", value: viewProvider.companyAddress },
                { label: "GST No", value: viewProvider.gstNo },
              ]}
            />
            <DetailCard
              title="Location"
              subtitle="Regional address details"
              rows={[
                { label: "Country", value: viewProvider.country },
                { label: "State", value: viewProvider.state },
                { label: "City", value: viewProvider.city },
                { label: "Pincode", value: viewProvider.pincode },
              ]}
            />
            <DetailCard
              title="Contact"
              subtitle="How to reach this service provider"
              rows={[
                {
                  label: "Contact",
                  value: viewProvider.countryCode
                    ? `${viewProvider.countryCode} ${viewProvider.contactNo}`
                    : viewProvider.contactNo,
                },
                { label: "Email", value: viewProvider.emailAdd },
              ]}
            />
          </EntityDetailLayout>
        )}
      </FormDrawer>



      {isUserDrawerOpen && selectedProviderForUser && (
        <>
          {!isCreateUserModalOpen && (
            <Card className="w-full border border-gray-200 shadow-sm">
              <CardHeader className="border-b bg-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <UserPlus className="w-5 h-5 text-indigo-600" />
                      Service Provider Users
                    </CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      View and manage users for selected service provider.
                    </p>
                  </div>

                  <div className="flex gap-2">
<Button
  type="button"
  onClick={() => {
    setEditingSpUser(null)
    setUserForm({
      firstName: "",
      lastName: "",
      username: "",
      password: "",
      role: "SERVICE_PROVIDER",
      serviceProviderID: selectedProviderForUser?.id ?? "",
      companyID: "",
      branchesID: "",
      isActive: true,
    })
    setShowPassword(false)
    setIsCreateUserModalOpen(true)
  }}
>
                        <Plus className="w-4 h-4 mr-2" />
                      Add User
                    </Button>

                    
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                <div className="rounded-xl border bg-indigo-50/60 px-4 py-3">
                  <p className="text-sm text-gray-500">Selected Service Provider</p>
                  <p className="text-base font-semibold text-gray-900">
                    {selectedProviderForUser?.companyName || "—"}
                  </p>
                </div>

                <div className="rounded-xl border bg-white overflow-hidden">
                  <div className="px-5 py-4 border-b">
                    <h3 className="text-base font-semibold text-gray-900">
                      Existing Service Provider Users
                    </h3>
                    <p className="text-sm text-gray-500">
                      Only SERVICE_PROVIDER users for this service provider are listed here.
                    </p>
                  </div>

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
                      {loadingSpUsers ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                            Loading users...
                          </TableCell>
                        </TableRow>
                      ) : spUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                            No service provider users found
                          </TableCell>
                        </TableRow>
                      ) : (
                        spUsers.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell className="font-medium">{u.username}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{u.role || "SERVICE_PROVIDER"}</Badge>
                            </TableCell>
                            <TableCell>
  <Badge variant={u.isActive ? "default" : "destructive"}>
    {u.isActive ? "Active" : "Inactive"}
  </Badge>
</TableCell>

<TableCell className="text-right">
  <div className="flex items-center justify-end gap-1">
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => handleEditServiceProviderUser(u)}
      className="h-7 w-7 p-0"
      title="Edit user"
    >
      <Edit className="w-3 h-3" />
    </Button>

    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => handleDeleteServiceProviderUser(u.id)}
      className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
      title="Delete user"
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
                </div>
              </CardContent>
            </Card>
          )}
          <FormDrawer
            open={isCreateUserModalOpen}
            onOpenChange={setIsCreateUserModalOpen}
title={editingSpUser ? "Update Service Provider User" : "Create Service Provider User"}
            description="This user will get SERVICE_PROVIDER role for this service provider only."
          >
            <form onSubmit={handleCreateServiceProviderUser} className="space-y-5">
              <div className="rounded-xl border bg-indigo-50/60 px-4 py-3">
                <p className="text-sm text-gray-500">Selected Service Provider</p>
                <p className="text-base font-semibold text-gray-900">
                  {selectedProviderForUser?.companyName || "—"}
                </p>
              </div>


              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input
                  autoComplete="first-name"
                  name="new-sp-user-first-name"
                  value={userForm.firstName}
                  onChange={(e) => setUserForm((p) => ({ ...p, firstName: e.target.value }))}
                  placeholder="Enter first name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input
                  autoComplete="last-name"
                  name="new-sp-user-last-name"
                  value={userForm.lastName}
                  onChange={(e) => setUserForm((p) => ({ ...p, lastName: e.target.value }))}
                  placeholder="Enter last name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Username *</Label>
                <Input
                  autoComplete="username"
                  name="new-sp-user-username"
                  value={userForm.username}
                  onChange={(e) => setUserForm((p) => ({ ...p, username: e.target.value }))}
                  placeholder="Enter username"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Password *</Label>
                <div className="relative">
                  <Input
                    autoComplete="new-password"
                    name="new-sp-user-password"
                    type={showPassword ? "text" : "password"}
                    value={userForm.password}
                    onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="Minimum 6 characters"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm bg-white">
                  <input
                    type="checkbox"
                    checked={userForm.isActive}
                    onChange={(e) => setUserForm((p) => ({ ...p, isActive: e.target.checked }))}
                  />
                  Active
                </label>
              </div>

              <div>
               < Label htmlFor="permissions">Permissions</Label>
                <div className="mt-1 text-sm text-gray-500"></div>
                <p>Permissions Coming Soon</p>
                </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsCreateUserModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={savingUser}>
{savingUser ? (editingSpUser ? "Updating..." : "Creating...") : (editingSpUser ? "Update User" : "Create User")}
                </Button>
              </div>
            </form>
          </FormDrawer>
        </>
      )}
      {!isDialogOpen && !isViewDialogOpen && !isUserDrawerOpen && (<>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search service providers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full bg-muted/40 border-transparent focus-visible:bg-background"
                />
              </div>
              <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
                {filteredProviders.length} total service providers
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="size-5 text-primary" />
              Service Providers List
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 w-full">
            <div className="overflow-x-auto w-full">
              <Table className="w-full">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Company Name</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Address</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Country</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">State</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">GST No</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Contact</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Email</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProviders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                        <div className="flex flex-col items-center gap-2">
                          <Icon icon="mdi:account-search" className="w-12 h-12 text-gray-300" />
                          <p>No service providers found</p>
                          <p className="text-sm">Try adjusting your search criteria</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProviders.map((provider) => (
                      <TableRow key={provider.id}>
                        <TableCell>{provider.companyName}</TableCell>
                        <TableCell>{provider.companyAddress}</TableCell>
                        <TableCell>{provider.country}</TableCell>
                        <TableCell>{provider.state}</TableCell>
                        <TableCell>{provider.gstNo}</TableCell>
                        <TableCell>{provider.contactNo}</TableCell>
                        <TableCell>{provider.emailAdd}</TableCell>
                        <TableCell className="text-right">

                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openCreateUserDrawer(provider)}
                              className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title="Create service provider user"
                            >
                              <UserPlus className="w-3 h-3" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleView(provider)}
                              className="h-7 w-7 p-0"
                              title="View service provider"
                            >
                              <Eye className="w-3 h-3" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(provider)}
                              className="h-7 w-7 p-0"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(provider.id)}
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
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
            </div>
          </CardContent>
        </Card>
      </>)}
    </div>
  )
}
