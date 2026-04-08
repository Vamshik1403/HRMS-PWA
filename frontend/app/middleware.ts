import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Auth must not run on Next.js assets or the browser gets 404 / failed chunk loads.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  const token =
    req.cookies.get('accessToken')?.value ||
    req.headers.get('Authorization')?.replace('Bearer ', '') ||
    null

  const isAuthPage = pathname.startsWith('/login') || pathname === '/'

  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Don't redirect authenticated users from auth pages - let client-side routing handle it
  // based on their role (employee vs admin)
  if (token && isAuthPage) {
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Do not run auth on Next internals or favicon — otherwise JS chunks/fonts 404 or abort on /login.
     */
    '/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico).*)',
  ],
}
