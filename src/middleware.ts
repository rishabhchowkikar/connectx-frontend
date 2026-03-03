import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Public routes that don't require authentication
    const publicRoutes = ['/login', '/register'];
    const isPublicRoute = publicRoutes.includes(pathname);
    
    // Protected routes that require authentication
    const protectedRoutes = ['/dashboard', '/call'];
    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

    // Root path
    const isRootPath = pathname === '/';

    // For cross-domain cookies, server-side middleware can't access browser cookies
    // So we'll be permissive and let client-side handle verification
    // However, we can still redirect based on route patterns
    
    // For public routes, allow access (client will redirect if authenticated)
    if (isPublicRoute) {
        return NextResponse.next();
    }
    
    // For protected routes and root, allow access
    // Client-side AuthContext will verify and redirect if needed
    // This is necessary because cross-domain cookies aren't accessible server-side
    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (public folder)
         */
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
