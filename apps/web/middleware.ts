import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { locales, defaultLocale } from "@repo/i18n/config";

import { FEATURE_FLAGS } from "./lib/posthog-config";
import { isFeatureFlagEnabled } from "./lib/posthog-server";

// Simple locale detection and redirection function
async function handleI18nRouting(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Check if multi-language feature is enabled
  const multiLanguageEnabled = await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);

  // If multi-language is disabled, only use default locale
  const availableLocales = multiLanguageEnabled ? locales : [defaultLocale];

  // Check if pathname already starts with a locale
  const pathnameHasLocale = availableLocales.some(
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
