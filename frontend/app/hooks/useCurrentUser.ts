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

function readStoredUser(): CurrentUser | null {
  if (typeof window === 'undefined') return null
  const data = localStorage.getItem('user')
  if (!data) return null
  try {
    const parsed = JSON.parse(data)
    if (parsed.role) {
      parsed.role = parsed.role.toUpperCase()
    }
    return parsed
  } catch {
    return null
  }
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(readStoredUser)

  useEffect(() => {
    const stored = readStoredUser()
    if (stored) {
      setUser(stored)
      return
    }

    // No valid user in localStorage — try to recover from JWT token
    const token = localStorage.getItem('accessToken')
    if (!token) return

    ;(async () => {
      try {
        const parts = token.split('.')
        if (parts.length < 2) return
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
        // Recover admin/manager or employee users from JWT when localStorage user is missing
        if (!payload.sub) return
        if (payload.type === 'employee' || payload.role === 'EMPLOYEE') {
          const employeeUser = {
            id: payload.employeeId ?? payload.sub,
            username: payload.username,
            role: 'EMPLOYEE' as const,
            type: 'employee',
            companyID: payload.companyID,
            serviceProviderID: payload.serviceProviderID,
            branchesID: payload.branchesID,
            employee: { id: payload.employeeId ?? payload.sub },
          }
          localStorage.setItem('user', JSON.stringify(employeeUser))
          setUser(employeeUser as CurrentUser)
          return
        }
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
