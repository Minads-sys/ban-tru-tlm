import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const userRole = req.auth?.user?.role;
  const pathname = nextUrl.pathname;

  // Allow public routes and API routes without auth
  if (pathname.startsWith('/api') || pathname === '/login' || pathname === '/student-login') {
    return NextResponse.next();
  }

  // Protect /admin/* routes (require staff roles)
  if (pathname.startsWith('/admin')) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL('/login', nextUrl));
    }
    const allowedRoles = ['ADMIN', 'BOARDING_MANAGER', 'BOARDING_STAFF', 'TEACHER', 'CASHIER'];
    if (!allowedRoles.includes(userRole as string)) {
      return NextResponse.redirect(new URL('/login', nextUrl));
    }
    return NextResponse.next();
  }

  // Protect /student routes (require authenticated user)
  if (pathname === '/student' || pathname.startsWith('/student/')) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL('/student-login', nextUrl));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
