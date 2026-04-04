'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'

interface User {
  id: string
  email: string
  name: string
  role: string
  avatar?: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  loading: boolean
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useLocalStorage<string | null>('authToken', null)
  const [loading, setLoading] = useState(true)

  const isAuthenticated = !!user && !!token

  useEffect(() => {
    // Check if user is logged in on app start
    if (token) {
      // Verify token and get user data
      // This would typically make an API call to verify the token
      // For now, we'll simulate it
      const verifyToken = async () => {
        try {
          // Simulate API call
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          // Mock user data - replace with actual API call
          setUser({
            id: '1',
            email: 'admin@company.com',
            name: 'Admin User',
            role: 'admin',
          })
        } catch (error) {
          console.error('Token verification failed:', error)
          setToken(null)
        } finally {
          setLoading(false)
        }
      }
      
      verifyToken()
    } else {
      setLoading(false)
    }
  }, [token, setToken])

  const login = async (email: string, password: string): Promise<boolean> => {
    setLoading(true)
    
    try {
      // Simulate API call - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Mock authentication - replace with actual API call
      if (email === 'admin@company.com' && password === 'password') {
        const mockToken = 'mock-jwt-token'
        const mockUser: User = {
          id: '1',
          email: email,
          name: 'Admin User',
          role: 'admin',
        }
        
        setToken(mockToken)
        setUser(mockUser)
        return true
      } else {
        throw new Error('Invalid credentials')
      }
    } catch (error) {
      console.error('Login failed:', error)
      return false
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    setToken(null)
    setUser(null)
  }

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    loading,
    isAuthenticated,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
