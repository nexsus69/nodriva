import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

export const proxy = NextAuth(authConfig).auth;

// Configura le rotte che devono essere intercettate dal middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes, incluse quelle di NextAuth)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login (login page)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|login|account/complete).*)',
  ],
};
