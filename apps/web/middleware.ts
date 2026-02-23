import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { locales, defaultLocale } from "@repo/i18n/config";

// Simple locale detection and redirection function
function handleI18nRouting(request: NextRequest) {
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

// New middleware function that only handles i18n routing
export function middleware(request: NextRequest) {
  // Handle i18n routing
  const i18nResponse = handleI18nRouting(request);
  if (i18nResponse) {
    return i18nResponse;
  }

  // Add current path header and continue
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-current-path", request.nextUrl.pathname);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    // Match i18n routes
    "/((?!api|static|ingest|.*\\..*|_next).*)",
  ],
};
