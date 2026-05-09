"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { PageLayout } from "../components/layout/PageLayout"
import { useCurrentUser } from "../hooks/useCurrentUser"

export default function SystemSettingsPage() {
  const user = useCurrentUser()
  const router = useRouter()

  useEffect(() => {
    if (user && (user.role === "SUPERADMIN" || user.role === "COMPANY_ADMIN")) {
      router.replace("/system-settings/compliance")
    }
  }, [router, user])

  if (user && user.role !== "SUPERADMIN" && user.role !== "COMPANY_ADMIN") {
    return (
      <PageLayout>
        <div className="p-8 text-center text-gray-500">Access restricted.</div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <div className="p-8 text-center text-gray-500">Redirecting...</div>
    </PageLayout>
  )
}
