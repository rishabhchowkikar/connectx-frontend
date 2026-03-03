import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const token = request.cookies.get('token')?.value;

    // Public routes that don't require authentication
    const publicRoutes = ['/login', '/register'];
    const isPublicRoute = publicRoutes.includes(pathname);
    
    // Protected routes that require authentication
    const protectedRoutes = ['/dashboard', '/call'];
    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

    // Root path
    const isRootPath = pathname === '/';

    // If no token, handle based on route type
    if (!token) {
        if (isProtectedRoute || isRootPath) {
            // Redirect to login if accessing protected route or root without auth
            const loginUrl = new URL('/login', request.url);
            return NextResponse.redirect(loginUrl);
        }
        // Allow access to public routes
        return NextResponse.next();
    }

    // If token exists, verify it with backend (server-side check)
    try {
        // Forward all cookies to backend for verification
        const cookieHeader = request.headers.get('cookie') || '';
        
        const response = await fetch(`${API_BASE}/api/auth/me`, {
            method: 'GET',
            headers: {
                'Cookie': cookieHeader,
                'User-Agent': request.headers.get('user-agent') || '',
            },
            credentials: 'include',
        });

        const isAuthenticated = response.ok;

        if (isAuthenticated) {
            // User is authenticated
            if (isPublicRoute) {
                // Redirect authenticated users away from login/register
                const dashboardUrl = new URL('/dashboard', request.url);
                return NextResponse.redirect(dashboardUrl);
            }
            if (isRootPath) {
                // Redirect root to dashboard if authenticated
                const dashboardUrl = new URL('/dashboard', request.url);
                return NextResponse.redirect(dashboardUrl);
            }
            // Allow access to protected routes
            return NextResponse.next();
        } else {
            // Token is invalid or expired
            if (isProtectedRoute || isRootPath) {
                // Clear invalid token and redirect to login
                const loginUrl = new URL('/login', request.url);
                const response = NextResponse.redirect(loginUrl);
                response.cookies.delete('token');
                return response;
            }
            // Allow access to public routes even with invalid token
            return NextResponse.next();
        }
    } catch (error) {
        // Backend error - be conservative and redirect protected routes
        console.error('Auth middleware error:', error);
        
        if (isProtectedRoute || isRootPath) {
            // If backend is down, redirect protected routes to login
            const loginUrl = new URL('/login', request.url);
            return NextResponse.redirect(loginUrl);
        }
        
        // Allow access to public routes even if backend check fails
        return NextResponse.next();
    }
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
