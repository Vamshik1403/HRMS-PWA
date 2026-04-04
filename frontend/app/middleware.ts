import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const token = req.cookies.get('accessToken')?.value || 
                req.headers.get('Authorization')?.replace('Bearer ', '') ||
                null

  const isAuthPage = req.nextUrl.pathname.startsWith('/login')

  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next()
}
