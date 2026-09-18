'use client'
import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Lock, User, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { LoginBrandPanel } from './LoginBrandPanel'
import { clearLegacyEmpPhoto } from '../utils/empPhotoCache'
import { clearInAppNotifications } from '../utils/empInAppNotifications'
import { clearPageCache, clearPageCachesByPrefix } from '../utils/pageCache'
import { isDesktopBrowser, resolveDesktopManagerAfterLogin } from '@/lib/desktopManager'
import { isJwtExpired } from '@/lib/jwtUtils'
import {
  persistCompanyAccessFromUser,
  isCompanyAdminLikeRole,
} from '@/lib/companyAccess'
import { preloadHeroImages } from '@/app/components/emp/desktop/HeroBackground'

const LOGIN_OTP_TTL_MS = 5 * 60 * 1000

function apiMessage(err: any, fallback: string) {
  const msg = err?.response?.data?.message
  if (Array.isArray(msg)) return msg.join(' ')
  if (typeof msg === 'string' && msg.trim()) return msg
  return fallback
}

function formatOtpCountdown(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [authChecked, setAuthChecked] = useState(false)

  const [loginOtpToken, setLoginOtpToken] = useState('')
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [loginOtpHint, setLoginOtpHint] = useState('')
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null)
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0)
  const otpRefs = useRef<Array<HTMLInputElement | null>>([])
  const loginOtp = otpDigits.join('')
  const otpExpired = !!loginOtpToken && otpSecondsLeft <= 0

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('subscriptionExpired') === '1') {
        const msg = params.get('msg')
        setError(
          msg
            ? decodeURIComponent(msg)
            : 'Your company subscription has expired. Please contact your administrator to renew it.',
        )
        window.history.replaceState({}, '', '/login')
      }
    } catch {
      /* ignore */
    }
  }, [])

  const setAccessTokenCookie = (token: string) => {
    const secure = window.location.protocol === 'https:' ? '; secure' : ''
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
        router.replace(role === 'SUPERADMIN' ? '/superdashboard' : isCompanyAdminLikeRole(role) ? '/my-company' : '/dashboard')
      } else {
        setAuthChecked(true)
      }
    } catch {
      setAuthChecked(true)
    }
  }, [router])

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

  useEffect(() => {
    if (!loginOtpToken || !otpExpiresAt) {
      setOtpSecondsLeft(0)
      return
    }
    const tick = () => {
      setOtpSecondsLeft(Math.max(0, Math.ceil((otpExpiresAt - Date.now()) / 1000)))
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [loginOtpToken, otpExpiresAt])

  const finishAuthenticatedSession = async (accessToken: string, basicUser: any) => {
    clearLegacyEmpPhoto()
    clearPageCache('empProfileData')
    clearPageCachesByPrefix('empNotifFeed')
    clearInAppNotifications()

    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('token', accessToken)
    setAccessTokenCookie(accessToken)

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
      return
    }

    try {
      const userDetailsRes = await axios.get(`/backend/users/${basicUser.id}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      const completeUser = {
        ...basicUser,
        ...userDetailsRes.data,
        userCompanies:
          userDetailsRes.data?.userCompanies?.length
            ? userDetailsRes.data.userCompanies
            : basicUser.userCompanies,
        companyIDs:
          userDetailsRes.data?.companyIDs?.length
            ? userDetailsRes.data.companyIDs
            : basicUser.companyIDs,
      }
      localStorage.setItem('user', JSON.stringify(completeUser))
      const role = String(completeUser.role || '').toUpperCase()
      const activeCompanyID = Number(
        completeUser.activeCompanyID || completeUser.companyID || completeUser.companyIDs?.[0] || 0,
      )
      if (Number.isFinite(activeCompanyID) && activeCompanyID > 0) {
        sessionStorage.setItem('activeCompanyID', String(activeCompanyID))
      }
      if (role === 'SUPERADMIN') {
        router.push('/superdashboard')
      } else if (isCompanyAdminLikeRole(role)) {
        router.push('/my-company')
      } else if (role === 'SERVICE_PROVIDER' || role === 'ADMIN' || role === 'BRANCH_ADMIN') {
        router.push('/dashboard')
      } else {
        preloadHeroImages(true)
        router.push('/empdashboard')
      }
    } catch {
      localStorage.setItem('user', JSON.stringify(basicUser))
      const role = String(basicUser.role || '').toUpperCase()
      const activeCompanyID = Number(
        basicUser.activeCompanyID || basicUser.companyID || basicUser.companyIDs?.[0] || 0,
      )
      if (Number.isFinite(activeCompanyID) && activeCompanyID > 0) {
        sessionStorage.setItem('activeCompanyID', String(activeCompanyID))
      }
      if (role === 'SUPERADMIN') {
        router.push('/superdashboard')
      } else if (isCompanyAdminLikeRole(role)) {
        router.push('/my-company')
      } else if (role === 'SERVICE_PROVIDER' || role === 'ADMIN' || role === 'BRANCH_ADMIN') {
        router.push('/dashboard')
      } else {
        preloadHeroImages(true)
        router.push('/empdashboard')
      }
    }
  }

  const beginOtpStep = (pendingToken: string, maskedEmail?: string) => {
    setLoginOtpToken(pendingToken)
    setOtpDigits(['', '', '', '', '', ''])
    setOtpExpiresAt(Date.now() + LOGIN_OTP_TTL_MS)
    setOtpSecondsLeft(Math.floor(LOGIN_OTP_TTL_MS / 1000))
    setLoginOtpHint(maskedEmail ? `OTP sent to ${maskedEmail}` : 'OTP sent to your email')
    setTimeout(() => otpRefs.current[0]?.focus(), 0)
  }

  const handleOtpChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1)
    const next = [...otpDigits]
    next[index] = digit
    setOtpDigits(next)
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    e.preventDefault()
    const next = ['', '', '', '', '', '']
    pasted.split('').forEach((ch, i) => {
      next[i] = ch
    })
    setOtpDigits(next)
    otpRefs.current[Math.min(pasted.length, 5)]?.focus()
  }

  const handleResendOtp = async () => {
    if (!loginOtpToken || loading) return
    setError('')
    setLoading(true)
    try {
      const res = await axios.post('/backend/auth/login/resend-otp', {
        pendingToken: loginOtpToken,
      })
      beginOtpStep(res.data.pendingToken, res.data.maskedEmail)
    } catch (err: any) {
      setError(apiMessage(err, 'Could not resend OTP. Try signing in again.'))
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (loginOtpToken) {
        if (otpExpired) {
          setError('This code has expired. Resend to get a new one.')
          return
        }
        if (loginOtp.length !== 6) {
          setError('Enter the 6-digit OTP sent to your email')
          return
        }
        const verifyRes = await axios.post('/backend/auth/login/verify-otp', {
          pendingToken: loginOtpToken,
          otp: loginOtp,
        })
        await finishAuthenticatedSession(verifyRes.data.accessToken, verifyRes.data.user)
        return
      }

      const loginRes = await axios.post('/backend/auth/login', {
        username,
        password,
        client: isDesktopBrowser() ? 'desktop' : 'mobile',
      })

      if (loginRes.data?.requiresOtp) {
        beginOtpStep(loginRes.data.pendingToken, loginRes.data.maskedEmail)
        return
      }

      await finishAuthenticatedSession(loginRes.data.accessToken, loginRes.data.user)
    } catch (err: any) {
      console.error(err)
      const serverMsg = err.response?.data?.message
      if (serverMsg === 'SUBSCRIPTION_EXPIRED') {
        setError('Your company subscription has expired. Please contact your administrator to renew it.')
      } else {
        setError(apiMessage(err, 'Invalid username or password'))
      }
    } finally {
      setLoading(false)
    }
  }

  if (!authChecked) return null

  return (
    <>
      <div className="fixed inset-0 z-0 grid overflow-hidden overscroll-none lg:relative lg:inset-auto lg:min-h-screen lg:h-auto lg:overflow-visible lg:grid-cols-[1.05fr_1fr]">
        <LoginBrandPanel />
        <main className="flex h-full min-h-0 flex-col items-center justify-center overflow-hidden overscroll-none p-6 dotted-bg bg-background sm:p-12">
          <div className="w-full max-w-md space-y-6 animate-fade-in sm:space-y-8">
            <div className="space-y-2">
              <div className="mb-6 flex items-center gap-2 lg:hidden">
                <img src="/img/OpenHRM_Logo.png" alt="OpenHRM" className="size-11 rounded-lg object-cover shadow-sm" />
                <span className="font-display text-xl font-semibold">OpenHRM</span>
              </div>
              <h2 className="font-display text-3xl font-medium tracking-tight">Sign in</h2>
              <p className="text-sm text-muted-foreground">Enter your credentials to continue</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username">Username or email</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Email or username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-9"
                    required
                    disabled={!!loginOtpToken}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-10"
                    required
                    disabled={!!loginOtpToken}
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {loginOtpToken ? (
                <div className="space-y-2">
                  <Label>Enter OTP</Label>
                  <div className="flex gap-2">
                    {otpDigits.map((digit, index) => (
                      <Input
                        key={index}
                        ref={(el) => {
                          otpRefs.current[index] = el
                        }}
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        onPaste={index === 0 ? handleOtpPaste : undefined}
                        className="h-12 w-12 text-center text-lg"
                        required
                        disabled={otpExpired}
                      />
                    ))}
                  </div>
                  {loginOtpHint ? (
                    <p className="text-xs text-muted-foreground">{loginOtpHint}</p>
                  ) : null}
                  <p className="text-sm text-muted-foreground">
                    {otpExpired
                      ? 'Code expired. Resend to get a new one.'
                      : `Code expires in ${formatOtpCountdown(otpSecondsLeft)}`}
                  </p>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading}
                    className="text-sm text-primary underline underline-offset-2 hover:text-primary/80 font-medium disabled:opacity-50"
                  >
                    Didn’t receive code? Resend
                  </button>
                </div>
              ) : null}

              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-lg px-3.5 py-2.5">
                  {error}
                </div>
              )}

              <Button type="submit" size="lg" className="w-full group" disabled={loading || ( !!loginOtpToken && otpExpired)}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <>{loginOtpToken ? 'Verify OTP' : 'Sign in'} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></>}
              </Button>
            </form>

            <div className="space-y-3 text-center">
              <a
                href="/forgot-password"
                className="text-sm text-primary underline underline-offset-2 hover:text-primary/80 font-medium"
              >
                Forgot password
              </a>

              <p className="text-xs text-muted-foreground leading-relaxed">
                By logging in, You acknowledge that you have read and agree to be bound by OpenHRM’s{' '}
                <a href="/terms-of-use" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80 font-medium">
                  Terms of Use
                </a>
                {', '}
                <a href="/privacy-policy" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80 font-medium">
                  Privacy Policy
                </a>
                {' & '}
                <a href="/sla" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80 font-medium">
                  SLA
                </a>
                .
              </p>
              <p className="text-xs text-muted-foreground">© 2026 OpenHRM · Human Resource Management System</p>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
