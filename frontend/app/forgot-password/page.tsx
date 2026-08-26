'use client'
import { useRef, useState } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { LoginBrandPanel } from '../login/LoginBrandPanel'

function apiMessage(err: any, fallback: string) {
  const msg = err?.response?.data?.message
  if (Array.isArray(msg)) return msg.join(' ')
  if (typeof msg === 'string' && msg.trim()) return msg
  return fallback
}

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<'identify' | 'otp' | 'password'>('identify')
  const [identifier, setIdentifier] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [hint, setHint] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const otpRefs = useRef<Array<HTMLInputElement | null>>([])

  const otp = otpDigits.join('')

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await axios.post('/backend/auth/forgot-password', {
        emailOrMobile: identifier,
      })
      setResetToken(res.data.resetToken)
      setOtpDigits(['', '', '', '', '', ''])
      setHint(res.data.message || `OTP sent to ${res.data.maskedEmail}`)
      setStep('otp')
    } catch (err: any) {
      setError(apiMessage(err, 'Wrong email address or email not found. Contact your administrator.'))
    } finally {
      setLoading(false)
    }
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

  const handleOtpContinue = (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length !== 6) {
      setError('Enter the 6-digit OTP sent to your email')
      return
    }
    setError('')
    setStep('password')
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match')
      return
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }
    setError('')
    setLoading(true)
    try {
      await axios.post('/backend/auth/forgot-password/verify', {
        resetToken,
        otp,
        newPassword,
        confirmPassword,
      })
      router.push('/login')
    } catch (err: any) {
      setError(apiMessage(err, 'Password reset failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-0 grid overflow-hidden overscroll-none lg:relative lg:inset-auto lg:min-h-screen lg:h-auto lg:overflow-visible lg:grid-cols-[1.05fr_1fr]">
      <LoginBrandPanel />
      <main className="flex h-full min-h-0 flex-col items-center justify-center overflow-hidden overscroll-none p-6 dotted-bg bg-background sm:p-12">
        <div className="w-full max-w-md space-y-6 animate-fade-in sm:space-y-8">
          <div className="space-y-2">
            <div className="mb-6 flex items-center gap-2 lg:hidden">
              <img src="/img/OpenHRM_Logo.png" alt="OpenHRM" className="size-11 rounded-lg object-cover shadow-sm" />
              <span className="font-display text-xl font-semibold">OpenHRM</span>
            </div>
            <h2 className="font-display text-3xl font-medium tracking-tight">Forgot password</h2>
            <p className="text-sm text-muted-foreground">
              {step === 'identify' && 'Enter your email or mobile number to receive an OTP.'}
              {step === 'otp' && (hint || 'Enter the 6-digit OTP sent to your email.')}
              {step === 'password' && 'Choose a new password for your account.'}
            </p>
          </div>

          {step === 'identify' ? (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="forgot-id">Email address or mobile number</Label>
                <Input
                  id="forgot-id"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Email or mobile number"
                  required
                />
              </div>
              {error ? (
                <div className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-lg px-3.5 py-2.5">
                  {error}
                </div>
              ) : null}
              <Button type="submit" size="lg" className="w-full group" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <>Send OTP <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></>}
              </Button>
            </form>
          ) : null}

          {step === 'otp' ? (
            <form onSubmit={handleOtpContinue} className="space-y-5">
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
                    />
                  ))}
                </div>
              </div>
              {error ? (
                <div className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-lg px-3.5 py-2.5">
                  {error}
                </div>
              ) : null}
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                Continue
              </Button>
            </form>
          ) : null}

          {step === 'password' ? (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="reset-new">New password</Label>
                <Input
                  id="reset-new"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reset-confirm">Confirm password</Label>
                <Input
                  id="reset-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              {error ? (
                <div className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-lg px-3.5 py-2.5">
                  {error}
                </div>
              ) : null}
              <Button type="submit" size="lg" className="w-full group" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <>Reset password <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></>}
              </Button>
            </form>
          ) : null}

          <div className="text-center">
            <a
              href="/login"
              className="text-sm text-primary underline underline-offset-2 hover:text-primary/80 font-medium"
            >
              Back to sign in
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}
