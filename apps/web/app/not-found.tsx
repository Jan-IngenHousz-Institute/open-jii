import { GoBackButton } from "@/components/go-back-button";
import { Home, Search, Sprout } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import React from "react";

import { defaultLocale, locales } from "@repo/i18n";
import type { Locale } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";
import { Button, Card, CardContent } from "@repo/ui/components";

/**
 * Global 404 Not Found Page with Locale Detection
 *
 * This page is displayed when users navigate to non-existent routes.
 * It detects the locale from the URL path and provides internationalized
 * error messages and locale-aware navigation options.
 *
 * Note: This component renders content only (no html/body tags) as those
 * are handled by the root layout to prevent hydration mismatches.
 *
 * Requirements addressed:
 * - 1.1: Custom 404 page with clear messaging
 * - 1.2: Navigation options to return to main application
 * - 1.3: Maintains application's visual design and branding
 * - 1.4: Helpful links including home page and main navigation
 * - 5.1: Content displayed in user's selected locale
 * - 5.3: Appropriate translations for error messages
 */
export default async function NotFound() {
  // Extract locale from the URL path
  const headersList = await headers();
  const pathname = headersList.get("x-current-path") ?? "";

  // Extract locale from pathname (e.g., /en-US/some-path -> en-US)
  const pathSegments = pathname.split("/").filter(Boolean);
  const potentialLocale = pathSegments[0] as Locale;

  // Use detected locale if valid, otherwise fall back to default
  const locale = locales.includes(potentialLocale) ? potentialLocale : defaultLocale;
  // Initialize translations for the detected locale
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4 py-16">
      <div className="w-full max-w-md text-center">
        {/* Brand Logo/Icon */}
        <div className="mb-8 flex justify-center">
          <div className="bg-primary/10 rounded-full p-6">
            <Sprout className="text-primary h-16 w-16" />
          </div>
        </div>

        {/* Error Message */}
        <div className="mb-8">
          <h1 className="mb-4 text-6xl font-bold text-gray-900">{t("errors.notFoundTitle")}</h1>
          <h2 className="mb-4 text-2xl font-semibold text-gray-800">
            {t("errors.notFoundHeading")}
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            {t("errors.notFoundMessage")}
          </p>
        </div>

        {/* Navigation Options */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-800">{t("errors.whereToGo")}</h3>
            <div className="space-y-3">
              {/* Home Page Link */}
              <Button asChild className="w-full" size="lg">
                <Link href={`/`} className="flex items-center justify-center gap-2">
                  <Home className="h-5 w-5" />
                  {t("errors.goToHomepage")}
                </Link>
              </Button>

              {/* Platform Link */}
              <Button asChild variant="outline" className="w-full" size="lg">
                <Link href={`/platform`} className="flex items-center justify-center gap-2">
                  <Sprout className="h-5 w-5" />
                  {t("errors.accessPlatform")}
                </Link>
              </Button>

              {/* About Page Link */}
              <Button asChild variant="outline" className="w-full" size="lg">
                <Link href={`/about`} className="flex items-center justify-center gap-2">
                  <Search className="h-5 w-5" />
                  {t("errors.learnAboutUs")}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer Branding */}
        <div className="mt-12 text-center">
          <Link
            href={`/`}
            className="text-primary hover:text-primary/80 inline-flex items-center gap-2 text-xl font-bold transition-colors"
          >
            <Sprout className="h-6 w-6" />
            {t("navigation.openJII")}
          </Link>
          <p className="text-muted-foreground mt-2 text-sm">{t("errors.brandTagline")}</p>
        </div>
      </div>
    </div>
  );
}
