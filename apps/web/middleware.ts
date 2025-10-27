import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { locales, defaultLocale } from "@repo/i18n/config";

import { isFeatureFlagEnabled } from "./lib/posthog-server";

// Simple locale detection and redirection function
async function handleI18nRouting(request: NextRequest) {
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

  // Check if user is trying to access a non-English locale
  const currentLocale = locales.find(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  );

  if (currentLocale && currentLocale !== defaultLocale) {
    // Check if multi-language feature flag is enabled
    const isMultiLanguageEnabled = await isFeatureFlagEnabled("multi-language");

    if (!isMultiLanguageEnabled) {
      // Rewrite to 404 page for non-English locales when feature is disabled
      // This prevents search engines from indexing these pages while showing custom 404
      const notFoundUrl = new URL(`/${defaultLocale}/404`, request.nextUrl.origin);
      return NextResponse.rewrite(notFoundUrl, { status: 404 });
    }
  }

  return null;
}

// New middleware function that only handles i18n routing
export async function middleware(request: NextRequest) {
  // Handle i18n routing
  const i18nResponse = await handleI18nRouting(request);
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
    "/((?!api|static|.*\\..*|_next).*)",
  ],
};
