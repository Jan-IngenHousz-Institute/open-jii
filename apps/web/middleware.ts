import { NextResponse } from "next/server";
import type { NextMiddleware, NextRequest } from "next/server";

import type { Session } from "@repo/auth/config";
import { middleware } from "@repo/auth/next";
import { locales, defaultLocale } from "@repo/i18n/config";

// Define the auth request type that includes auth information
interface AuthRequest extends NextRequest {
  auth?: Session | null;
}

// Simple locale detection and redirection function
function handleI18nRouting(request: AuthRequest) {
  const pathname = request.nextUrl.pathname;

  // Check if pathname already starts with a locale
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  );

  if (!pathnameHasLocale) {
    // Redirect to default locale
    const locale = defaultLocale;
    const redirectUrl = new URL(
      `/${locale}${pathname}${request.nextUrl.search}`,
      request.nextUrl.origin,
    );
    return NextResponse.redirect(redirectUrl);
  }

  return null;
}

export default middleware((request) => {
  // First handle i18n routing
  const i18nResponse = handleI18nRouting(request);
  if (i18nResponse) {
    return i18nResponse;
  }

  // Handle login page redirects - if user is logged in and trying to access login page
  if (request.nextUrl.pathname.includes("/login") && request.auth) {
    return NextResponse.redirect(new URL(`/${defaultLocale}/platform`, request.nextUrl.origin));
  }

  // Handle protected routes
  if (request.nextUrl.pathname.includes("/platform") && !request.auth) {
    const callbackUrl = encodeURIComponent(
      `${request.nextUrl.origin}${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    const newUrl = new URL(`/api/auth/signin?=${callbackUrl}`, request.nextUrl.origin);
    return Response.redirect(newUrl);
  }

  // Clone incoming headers and add our own
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-current-path", request.nextUrl.pathname);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}) as NextMiddleware;

export const config = {
  matcher: [
    // Match i18n routes
    "/((?!api|static|.*\\..*|_next).*)",
    // Match auth routes
    "/platform/:path*",
    "/login",
  ],
};
