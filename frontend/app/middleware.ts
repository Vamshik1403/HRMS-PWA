import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    )
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

function isTokenValid(token: string): boolean {
  const exp = decodeJwtExp(token)
  if (exp == null) return false
  return exp * 1000 > Date.now()
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
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

  const isAuthPage = pathname.startsWith('/login') || pathname === '/'

  if (!token || !isTokenValid(token)) {
    if (isAuthPage) {
      const res = NextResponse.next()
      if (token && !isTokenValid(token)) {
        res.cookies.set('accessToken', '', { path: '/', maxAge: 0 })
      }
      return res
    }
    const res = NextResponse.redirect(new URL('/login', req.url))
    res.cookies.set('accessToken', '', { path: '/', maxAge: 0 })
    return res
  }

  if (token && isAuthPage) {
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico).*)',
  ],
}
