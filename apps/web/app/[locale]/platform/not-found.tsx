"use client";

import { Code, FileSliders, Home, Microscope } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components";

/**
 * Platform 404 Not Found Page
 *
 * This page is displayed when users navigate to non-existent routes within the platform.
 * It renders within the platform layout, keeping the sidebar visible for easy navigation.
 */
export default function PlatformNotFound() {
  const { t } = useTranslation("common");
  const { t: tNav } = useTranslation("navigation");
  const pathname = usePathname();

  // Determine which section the user is in based on pathname
  const getSecondaryNavigation = () => {
    if (pathname.includes("/protocols")) {
      return {
        href: "/platform/protocols",
        label: tNav("sidebar.protocols"),
        Icon: FileSliders,
      };
    }
    if (pathname.includes("/macros")) {
      return {
        href: "/platform/macros",
        label: tNav("sidebar.macros"),
        Icon: Code,
      };
    }
    // Default to experiments
    return {
      href: "/platform/experiments",
      label: tNav("sidebar.experiments"),
      Icon: Microscope,
    };
  };

  const secondaryNav = getSecondaryNavigation();

  return (
    <div className="flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        {/* 404 Display */}
        <div className="mb-6">
          <span className="text-muted-foreground text-8xl font-bold">404</span>
        </div>

        {/* Error Message */}
        <div className="mb-8">
          <h1 className="mb-2 text-2xl font-semibold">{t("errors.notFound")}</h1>
          <p className="text-muted-foreground">{t("errors.resourceNotFoundMessage")}</p>
        </div>

        {/* Navigation Options */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/platform" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              {t("errors.backToDashboard")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={secondaryNav.href} className="flex items-center gap-2">
              <secondaryNav.Icon className="h-4 w-4" />
              {secondaryNav.label}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
