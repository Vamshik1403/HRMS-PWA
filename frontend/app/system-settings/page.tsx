"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { isCompanyAdminLikeRole } from "@/lib/companyAccess";

export default function SystemSettingsPage() {
  const user = useCurrentUser()
  const router = useRouter()

  useEffect(() => {
    if (user && (user.role === "SUPERADMIN" || isCompanyAdminLikeRole(user.role))) {
      router.replace("/system-settings/general")
    }
  }, [router, user])

  if (user && user.role !== "SUPERADMIN" && !isCompanyAdminLikeRole(user.role)) {
    return (
      <div className="p-8 text-center text-gray-500">Access restricted.</div>
    )
  }

  return (
    <div className="p-8 text-center text-gray-500">Redirecting...</div>
  )
}
