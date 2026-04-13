// hooks/useCurrentUser.ts
'use client'

import { useEffect, useState } from 'react'

export interface CurrentUser {
  id: number
  username: string
  role: "SUPERADMIN" | "MANAGER" | "COMPANY_ADMIN" | "EMPLOYEE"

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
        console.log("Raw user data from localStorage:", parsed) // Debug log
        // Normalize role to uppercase for consistent checks
        if (parsed.role) {
          parsed.role = parsed.role.toUpperCase()
        }
        setUser(parsed)
      } catch {
        setUser(null)
      }
    }
  }, [])

  return user
}