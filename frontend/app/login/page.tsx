'use client'
import { useState } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Lock, User, LogIn } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // Step 1: Login to get token and basic user info
      const loginRes = await axios.post('/backend/auth/login', {
        username,
        password,
      })
      
      const { accessToken, user: basicUser } = loginRes.data

      // Save token in localStorage and cookie (middleware reads the cookie)
      localStorage.setItem('accessToken', accessToken)
      document.cookie = `accessToken=${accessToken}; path=/; max-age=${60 * 60 * 24};`

      // Step 2: For employees, use login response directly (no /users/:id lookup)
      // Employee IDs can collide with user IDs in the Users table, so skip the fetch.
      if (basicUser.type === 'employee' || basicUser.role === 'EMPLOYEE') {
        localStorage.setItem('user', JSON.stringify(basicUser))
        setTimeout(() => {
          router.push('/empdashboard')
        }, 100)
      } else {
        // For admin/manager users, fetch complete user details with all relations
        try {
          const userDetailsRes = await axios.get(`/backend/users/${basicUser.id}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          })
          
          const completeUser = userDetailsRes.data
          console.log('Complete user data:', completeUser)
          localStorage.setItem('user', JSON.stringify(completeUser))

          setTimeout(() => {
            if (completeUser.role === 'SUPERADMIN' || completeUser.role === 'MANAGER') {
              router.push('/dashboard')
            } else {
              router.push('/empdashboard')
            }
          }, 100)
        } catch (detailsError) {
          console.error('Error fetching user details:', detailsError)
          localStorage.setItem('user', JSON.stringify(basicUser))
          
          setTimeout(() => {
            if (basicUser.role === 'SUPERADMIN' || basicUser.role === 'MANAGER') {
              router.push('/dashboard')
            } else {
              router.push('/empdashboard')
            }
          }, 100)
          
          return
        }
      }
      
    } catch (err: any) {
      console.error(err)
      setError(err.response?.data?.message || 'Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f4f4] relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #000 1px, transparent 0)', backgroundSize: '32px 32px' }} />

      <div className="relative w-full max-w-[420px] mx-4">
        {/* Brand header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gray-900 flex items-center justify-center text-white text-lg font-bold shadow-[0_4px_20px_rgba(0,0,0,0.15)] mb-4">
            HR
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">OpenHRM</h1>
          <p className="text-sm text-gray-400 mt-0.5">Human Resource Management</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04),0_8px_32px_rgba(0,0,0,0.06)] border border-gray-100 p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Sign in</h2>
            <p className="text-sm text-gray-400 mt-1">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Username</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-[18px] h-[18px]" />
                <input
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-[#f8f8f8] border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 focus:bg-white outline-none text-gray-800 text-sm transition-all placeholder:text-gray-400"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-[18px] h-[18px]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-2.5 bg-[#f8f8f8] border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 focus:bg-white outline-none text-gray-800 text-sm transition-all placeholder:text-gray-400"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="w-[18px] h-[18px]" />
                  ) : (
                    <Eye className="w-[18px] h-[18px]" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-semibold rounded-xl transition-all duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2 shadow-[0_1px_3px_rgba(0,0,0,0.1),0_4px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_2px_6px_rgba(0,0,0,0.15),0_8px_24px_rgba(0,0,0,0.12)] active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign in
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} OpenHRM · Human Resource Management System
        </p>
      </div>
    </div>
  )
}