'use client'
import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Lock, User, LogIn } from 'lucide-react'

const TERMS_AND_CONDITIONS = `TERMS AND CONDITIONS & END USER LICENSE AGREEMENT

Last Updated: April 27, 2026

PLEASE READ THESE TERMS & CONDITIONS CAREFULLY BEFORE USING THE OPENHRM SOFTWARE.

1. ACCEPTANCE OF TERMS
By accessing or using OpenHRM ("the Software"), you agree to be bound by these Terms & Conditions and End User License Agreement ("Agreement"). If you do not agree to these terms, you may not use the Software.

2. LICENSE GRANT
Subject to your compliance with this Agreement, OpenHRM grants you a limited, non-exclusive, non-transferable, revocable license to access and use the Software solely for your organization's internal human resource management purposes.

3. RESTRICTIONS
You agree not to:
(a) Copy, modify, or distribute the Software without prior written consent;
(b) Reverse engineer, decompile, or disassemble the Software;
(c) Use the Software for any unlawful or unauthorized purpose;
(d) Share your login credentials with unauthorized parties;
(e) Attempt to gain unauthorized access to any part of the Software or its related systems.

4. DATA PRIVACY AND SECURITY
4.1 The Software collects and processes personal data of employees as directed by your organization. You are responsible for ensuring lawful basis for such processing under applicable data protection laws (including but not limited to GDPR, PDPA, IT Act 2000).
4.2 You agree to implement appropriate technical and organizational measures to protect personal data.
4.3 OpenHRM is not liable for data breaches resulting from your negligence or misuse.

5. INTELLECTUAL PROPERTY
All intellectual property rights in the Software, including but not limited to source code, design, trademarks, and documentation, remain the exclusive property of OpenHRM and its licensors.

6. CONFIDENTIALITY
You agree to keep confidential any non-public information about the Software and not disclose it to third parties without prior written consent.

7. DISCLAIMERS
THE SOFTWARE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. OPENHRM DOES NOT WARRANT THAT THE SOFTWARE WILL BE ERROR-FREE OR UNINTERRUPTED.

8. LIMITATION OF LIABILITY
TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, OPENHRM SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SOFTWARE.

9. INDEMNIFICATION
You agree to indemnify, defend, and hold harmless OpenHRM and its officers, directors, employees, and agents from any claims, liabilities, damages, losses, and expenses arising out of or related to your use of the Software or violation of this Agreement.

10. TERMINATION
This Agreement is effective until terminated. Your rights under this Agreement will terminate automatically if you fail to comply with any of its terms. Upon termination, you must cease all use of the Software and destroy all copies in your possession.

11. GOVERNING LAW
This Agreement shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law provisions. Any disputes shall be subject to the exclusive jurisdiction of the courts of Hyderabad, Telangana, India.

12. MODIFICATIONS TO TERMS
OpenHRM reserves the right to modify these Terms at any time. Continued use of the Software after changes constitutes acceptance of the modified terms.

13. CONTACT INFORMATION
For questions regarding these Terms and Conditions, please contact:
OpenHRM Support Team
Email: support@openhrm.com

BY CHECKING THE ACCEPTANCE BOX AND USING THE SOFTWARE, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THESE TERMS AND CONDITIONS.`

function TermsModal({ onClose }: { onClose: () => void }) {
  const [canAccept, setCanAccept] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handleScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 10
      if (atBottom) setCanAccept(true)
    }
    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col" style={{ maxHeight: '80vh' }}>
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Terms and Conditions & EULA</h2>
          <p className="text-xs text-gray-400 mt-0.5">Please read the entire document before accepting</p>
        </div>
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-6 py-4 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap"
          style={{ minHeight: 0 }}
        >
          {TERMS_AND_CONDITIONS}
        </div>
        {!canAccept && (
          <p className="text-center text-xs text-amber-600 bg-amber-50 px-4 py-2 border-t border-amber-100">
            Scroll to the bottom to enable the Accept button
          </p>
        )}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button
            disabled={!canAccept}
            onClick={onClose}
            className="px-5 py-2 bg-[#4f46e5] text-white text-sm font-semibold rounded-xl transition-all disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-[#4338ca]"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!termsAccepted) {
      setError('You must accept the Terms & Conditions to continue.')
      return
    }
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
            if (completeUser.role === 'SUPERADMIN' || completeUser.role === 'SERVICE_PROVIDER' || completeUser.role === 'COMPANY_ADMIN' || completeUser.role === 'BRANCH_ADMIN') {
              router.push('/dashboard')
            } else {
              router.push('/empdashboard')
            }
          }, 100)
        } catch (detailsError) {
          console.error('Error fetching user details:', detailsError)
          localStorage.setItem('user', JSON.stringify(basicUser))
          
          setTimeout(() => {
            if (basicUser.role === 'SUPERADMIN' || basicUser.role === 'SERVICE_PROVIDER' || basicUser.role === 'COMPANY_ADMIN' || basicUser.role === 'BRANCH_ADMIN') {
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
    <>
      {showTermsModal && (
        <TermsModal onClose={() => { setShowTermsModal(false); setTermsAccepted(true) }} />
      )}
    <div className="min-h-screen flex items-center justify-center bg-[#f4f4f4] relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #000 1px, transparent 0)', backgroundSize: '32px 32px' }} />

      <div className="relative w-full max-w-[420px] mx-4">
        {/* Brand header */}
        <div className="flex flex-col items-center mb-5">
          <img src="/img/OpenHRM_Logo.png" alt="OpenHRM" className="w-14 h-14 rounded-full object-cover shrink-0 shadow-[0_6px_16px_rgba(79,70,229,0.35)] mb-3" />
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">OpenHRM</h1>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04),0_8px_32px_rgba(0,0,0,0.06)] border border-gray-100 p-8">
          <div className="mb-5">
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

            {/* Terms and Conditions Checkbox */}
            <div className="flex items-start gap-2.5 pt-0.5">
              <input
                id="terms-checkbox"
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-[#4f46e5] accent-[#4f46e5] cursor-pointer"
              />
              <label htmlFor="terms-checkbox" className="text-xs text-gray-500 leading-snug cursor-pointer select-none">
                Accept the{' '}
                <button
                  type="button"
                  onClick={() => setShowTermsModal(true)}
                  className="text-[#4f46e5] underline underline-offset-2 hover:text-[#4338ca] font-medium focus:outline-none"
                >
                  terms & conditions
                </button>
                {' '}and end user license agreement
              </label>
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

        <p className="text-center text-xs text-gray-400 mt-5">
          © {new Date().getFullYear()} OpenHRM · Human Resource Management System
        </p>
      </div>
    </div>
    </>
  )
}