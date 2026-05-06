// hooks/useCurrentUser.ts
'use client'

import { useEffect, useState } from 'react'

export interface CurrentUser {
  id: number
  username: string
  role: "SUPERADMIN" | "SERVICE_PROVIDER" | "COMPANY_ADMIN" | "ADMIN" | "BRANCH_ADMIN" | "EMPLOYEE"

  serviceProviderID?: number
  companyID?: number
  branchesID?: number

  // Nested objects from API
  serviceProvider?: {
    companyName: string
  }
  company?: {
    companyName: string
  }
  branches?: {
    branchName: string
  }

  type?: string
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null)

  useEffect(() => {
    const data = localStorage.getItem('user')
    if (data) {
      try {
        const parsed = JSON.parse(data)
        // Normalize role to uppercase for consistent checks
        if (parsed.role) {
          parsed.role = parsed.role.toUpperCase()
        }
        setUser(parsed)
        return
      } catch {
        // fall through to token-based recovery
      }
    }

    // No valid user in localStorage — try to recover from JWT token
    const token = localStorage.getItem('accessToken')
    if (!token) return

    ;(async () => {
      try {
        const parts = token.split('.')
        if (parts.length < 2) return
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
        // Only recover admin/manager users (not employees)
        if (!payload.sub || payload.type === 'employee' || payload.role === 'EMPLOYEE') return
        const res = await fetch(`/backend/users/${payload.sub}`)
        if (!res.ok) return
        const userData = await res.json()
        if (!userData || !userData.role) return
        userData.role = userData.role.toUpperCase()
        localStorage.setItem('user', JSON.stringify(userData))
        setUser(userData)
      } catch { /* ignore */ }
    })()
  }, [])

  return user
}