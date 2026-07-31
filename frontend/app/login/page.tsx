'use client'
import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Lock, User, LogIn, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { NoticeBanner } from '@/app/components/ui/notice-banner'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { LoginBrandPanel } from './LoginBrandPanel'
import { clearLegacyEmpPhoto } from '../utils/empPhotoCache'
import { clearInAppNotifications } from '../utils/empInAppNotifications'
import { clearPageCache, clearPageCachesByPrefix } from '../utils/pageCache'
import { registerPushSubscription } from '@/lib/pushSubscribe'
import { resolveDesktopManagerAfterLogin } from '@/lib/desktopManager'
import { isJwtExpired } from '@/lib/jwtUtils'
import {
  persistCompanyAccessFromUser,
} from '@/lib/companyAccess'
import { preloadHeroImages } from '@/app/components/emp/desktop/HeroBackground'

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
          <NoticeBanner variant="warning" compact className="rounded-none border-0 shadow-none ring-0 bg-amber-500/[0.06]">
            Scroll to the bottom to enable the Accept button
          </NoticeBanner>
        )}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button
            disabled={!canAccept}
            onClick={onClose}
            className="px-5 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl transition-all disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed hover:bg-primary/90"
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
  const [termsAccepted, setTermsAccepted] = useState(true)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  const setAccessTokenCookie = (token: string) => {
    const secure = window.location.protocol === 'https:' ? '; secure' : ''
    // Session cookie — cleared when the browser session ends (browser/tab closed).
    document.cookie = `accessToken=${token}; path=/; samesite=lax${secure}`
  }

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (token && isJwtExpired(token)) {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('token')
      document.cookie = 'accessToken=; path=/; max-age=0'
      setAuthChecked(true)
      return
    }
    if (!token) {
      setAuthChecked(true)
      return
    }

    // Ensure middleware can see auth after app relaunch in PWA/browser.
    setAccessTokenCookie(token)

    const userRaw = localStorage.getItem('user')
    if (!userRaw) {
      setAuthChecked(true)
      return
    }

    try {
      const user = JSON.parse(userRaw)
      const role = String(user?.role || '').toUpperCase()

      if (role === 'EMPLOYEE' || user?.type === 'employee') {
        router.replace('/empdashboard')
      } else if (role) {
  router.replace(role === 'SUPERADMIN' ? '/superdashboard' : '/dashboard')
} else {
        setAuthChecked(true)
      }
    } catch {
      // Keep user on login if stored user object is invalid.
      setAuthChecked(true)
    }
  }, [router])

  // Lock page scroll on mobile / PWA login (prevents empty rubber-band scroll).
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = body.style.overflow
    const prevHtmlOverscroll = html.style.overscrollBehavior
    const prevBodyOverscroll = body.style.overscrollBehavior
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    body.style.overscrollBehavior = 'none'
    return () => {
      html.style.overflow = prevHtmlOverflow
      body.style.overflow = prevBodyOverflow
      html.style.overscrollBehavior = prevHtmlOverscroll
      body.style.overscrollBehavior = prevBodyOverscroll
    }
  }, [])

  if (!authChecked) return null

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

      clearLegacyEmpPhoto()
      clearPageCache('empProfileData')
      clearPageCachesByPrefix('empNotifFeed')
      clearInAppNotifications()

      // Save token in localStorage and cookie (middleware reads the cookie)
      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('token', accessToken)
      setAccessTokenCookie(accessToken)

      // Step 2: For employees, use login response directly (no /users/:id lookup)
      // Employee IDs can collide with user IDs in the Users table, so skip the fetch.
      if (basicUser.type === 'employee' || basicUser.role === 'EMPLOYEE') {
        localStorage.setItem('user', JSON.stringify(basicUser))
        await resolveDesktopManagerAfterLogin(accessToken)
        try {
          const accessRes = await axios.get('/backend/employee-permissions/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          const access = accessRes.data
          const enriched = {
            ...basicUser,
            isCompanyOwner: !!access?.isCompanyOwner,
            ownerTitle: access?.ownerTitle ?? basicUser.ownerTitle ?? null,
            permissions: access?.permissions ?? [],
            hasAnyCompanyAccess: !!access?.hasAnyCompanyAccess,
            employee: {
              ...(basicUser.employee || {}),
              isCompanyOwner: !!access?.isCompanyOwner,
              ownerTitle: access?.ownerTitle ?? null,
            },
          }
          localStorage.setItem('user', JSON.stringify(enriched))
          persistCompanyAccessFromUser(enriched)
        } catch {
          persistCompanyAccessFromUser(basicUser)
        }
        preloadHeroImages(true)
        router.push('/empdashboard')
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
            const role = String(completeUser.role || '').toUpperCase()

if (role === 'SUPERADMIN') {
  router.push('/superdashboard')
} else if (role === 'SERVICE_PROVIDER' || role === 'COMPANY_ADMIN' || role === 'ADMIN' || role === 'BRANCH_ADMIN') {
  router.push('/dashboard')
} else {
  preloadHeroImages(true)
  router.push('/empdashboard')
}
          }, 100)
        } catch (detailsError) {
          console.error('Error fetching user details:', detailsError)
          localStorage.setItem('user', JSON.stringify(basicUser))
          
          setTimeout(() => {
           const role = String(basicUser.role || '').toUpperCase()

if (role === 'SUPERADMIN') {
  router.push('/superdashboard')
} else if (role === 'SERVICE_PROVIDER' || role === 'COMPANY_ADMIN' || role === 'ADMIN' || role === 'BRANCH_ADMIN') {
  router.push('/dashboard')
} else {
  preloadHeroImages(true)
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
      <div className="fixed inset-0 z-0 grid overflow-hidden overscroll-none lg:relative lg:inset-auto lg:min-h-screen lg:h-auto lg:overflow-visible lg:grid-cols-[1.05fr_1fr]">
        <LoginBrandPanel />
        <main className="flex h-full min-h-0 flex-col items-center justify-center overflow-hidden overscroll-none p-6 dotted-bg bg-background sm:p-12">
          <div className="w-full max-w-md space-y-6 animate-fade-in sm:space-y-8">
            <div className="space-y-2">
              <div className="mb-6 flex items-center gap-2 lg:hidden">
                <img src="/img/OpenHRM_Logo.png" alt="OpenHRM" className="size-9 rounded-lg object-cover shadow-sm" />
                <span className="font-display text-lg font-semibold">OpenHRM</span>
              </div>
              <h2 className="font-display text-3xl font-medium tracking-tight">Sign in</h2>
              <p className="text-sm text-muted-foreground">Enter your credentials to continue</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
                  <Input id="username" type="text" placeholder="Enter username" value={username} onChange={(e) => setUsername(e.target.value)} className="pl-9" required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
                  <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9 pr-10" required />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <input id="terms-checkbox" type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="app-form-checkbox mt-0.5 h-4 w-4 shrink-0 rounded border-input cursor-pointer" />
                <label htmlFor="terms-checkbox" className="text-xs text-muted-foreground leading-snug cursor-pointer select-none">
                  Accept the{' '}
                  <button type="button" onClick={() => setShowTermsModal(true)} className="text-primary underline underline-offset-2 hover:text-primary/80 font-medium focus:outline-none">
                    terms & conditions
                  </button>
                  {' '}and end user license agreement
                </label>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-lg px-3.5 py-2.5">
                  {error}
                </div>
              )}

              <Button type="submit" size="lg" className="w-full group" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <>Sign in <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></>}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground">© {new Date().getFullYear()} OpenHRM · Human Resource Management System</p>
          </div>
        </main>
      </div>
    </>
  )
}