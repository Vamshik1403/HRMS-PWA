import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isDeniedTenantsRole, isSuperadminOnlyPath, isTenantsPath } from '@/lib/superadminRoutes'

function decodeJwt(token: string): { exp?: number; role?: string } | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const payload = JSON.parse(atob(padded))
    return payload && typeof payload === 'object' ? payload : null
  } catch {
    return null
  }
}

function isTokenValid(payload: { exp?: number } | null): boolean {
  if (!payload || typeof payload.exp !== 'number') return false
  return payload.exp * 1000 > Date.now()
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/backend/company-policies/public') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/img') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.json') ||
    pathname === '/manifest.json' ||
    pathname === '/push-sw.js' ||
    pathname === '/push-notification-routing.js' ||
    pathname === '/worker-push.js' ||
    pathname === '/openhrm-sw.js' ||
    pathname === '/sw.js'
  ) {
    return NextResponse.next()
  }

  const token =
    req.cookies.get('accessToken')?.value ||
    req.headers.get('Authorization')?.replace('Bearer ', '') ||
    null
  const payload = token ? decodeJwt(token) : null
  const valid = isTokenValid(payload)

  const isAuthPage =
    pathname.startsWith('/login') ||
    pathname === '/' ||
    pathname === '/access-denied' ||
    pathname === '/terms-of-use' ||
    pathname === '/privacy-policy' ||
    pathname === '/sla'

  if (!token || !valid) {
    if (isAuthPage) {
      const res = NextResponse.next()
      if (token && !valid) {
        res.cookies.set('accessToken', '', { path: '/', maxAge: 0 })
      }
      return res
    }
    const login = new URL('/login', req.url)
    login.searchParams.set('next', pathname)
    const res = NextResponse.redirect(login)
    res.cookies.set('accessToken', '', { path: '/', maxAge: 0 })
    return res
  }

  const role = String(payload?.role || '').toUpperCase()
  if (isSuperadminOnlyPath(pathname) && role !== 'SUPERADMIN') {
    return NextResponse.redirect(new URL('/access-denied', req.url))
  }
  if (isTenantsPath(pathname) && isDeniedTenantsRole(role)) {
    return NextResponse.redirect(new URL('/access-denied', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico).*)',
  ],
}
