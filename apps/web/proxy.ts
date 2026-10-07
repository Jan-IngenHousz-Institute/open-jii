import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { locales, defaultLocale } from "@repo/i18n/config";

const localeIndependentRoutes = new Set(["/opengraph-image", "/twitter-image"]);

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

/**
 * Another locale is a feature only some viewers have. It is decided here, before
 * any page renders, so the pages read nothing from the request and can be cached.
 * A viewer without it gets the same page in the default locale, so a signed-out
 * member of a targeted organization still reaches login rather than a 404.
 */
async function handleLocaleAccess(request: NextRequest) {
  const { pathname, search, origin } = request.nextUrl;
  const locale = pathname.split("/")[1] ?? "";
  if (locale === defaultLocale) {
    return null;
  }

  // Client navigations and prefetches start from a page in this locale or from the locale switcher,
  // which only viewers with the feature see; the document request already decided for them.
  if (request.headers.get("rsc") === "1") {
    return null;
  }

  // Loaded only here, so a default-locale request never pays for PostHog.
  const [{ isFeatureFlagEnabledForRequest }, { FEATURE_FLAGS }] = await Promise.all([
    import("~/lib/posthog-server"),
    import("@repo/analytics"),
  ]);
  if (await isFeatureFlagEnabledForRequest(FEATURE_FLAGS.MULTI_LANGUAGE, request.headers)) {
    return null;
  }

  const rest = pathname.slice(locale.length + 1);
  return NextResponse.redirect(new URL(`/${defaultLocale}${rest}${search}`, origin));
}

// Proxy function that handles i18n routing
export async function proxy(request: NextRequest) {
  const normalizedPathname = request.nextUrl.pathname.replace(/\/+$/, "");
  if (localeIndependentRoutes.has(normalizedPathname)) {
    return NextResponse.next();
  }

  // Handle i18n routing
  const i18nResponse = handleI18nRouting(request);
  if (i18nResponse) {
    return i18nResponse;
  }

  const localeResponse = await handleLocaleAccess(request);
  if (localeResponse) {
    return localeResponse;
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
    // Match i18n routes. `ingest` is the PostHog reverse proxy: its flags and
    // capture paths carry no file extension, so without this exclusion the
    // locale redirect turns them into 404s and no feature flag ever loads.
    // Static files are left out by extension, so a page slug with a dot in it
    // still passes through the locale gate.
    "/((?!api|ingest|static|_next|.*\\.(?:ico|png|jpe?g|svg|webp|avif|gif|txt|xml)$).*)",
  ],
};
