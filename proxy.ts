import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenEdge } from '@/lib/jwt-edge';

const PUBLIC_API_PATHS = [
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/magic-links',
  '/api/videos',
  '/api/bookings',
  '/api/contact',
  '/api/vehicle-metadata',
];

function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

const PROTECTED_PAGES = ['/admin', '/staff'];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Page route protection — redirect to login if no token cookie
  if (PROTECTED_PAGES.some((p) => pathname.startsWith(p))) {
    const token = req.cookies.get('token')?.value ?? null;
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    try {
      const decoded = await verifyTokenEdge(token);
      // Admin-only pages
      if (pathname.startsWith('/admin')) {
        const role = req.cookies.get('role')?.value;
        if (role !== 'admin') {
          return NextResponse.redirect(new URL('/staff', req.url));
        }
      }
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set('x-user-id', decoded.id);
      return NextResponse.next({ request: { headers: requestHeaders } });
    } catch {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  // API route protection
  if (!pathname.startsWith('/api/') || isPublicApiPath(pathname)) {
    return NextResponse.next();
  }

  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return NextResponse.json({ message: 'Not authorized' }, { status: 401 });
  }

  try {
    await verifyTokenEdge(token);
    return NextResponse.next();
  } catch {
    return NextResponse.json({ message: 'Not authorized, token failed' }, { status: 401 });
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
};
