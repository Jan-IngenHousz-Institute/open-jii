"use client";

import { usePathname } from "next/navigation";
import React from "react";

import { useTranslation } from "@repo/i18n";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@repo/ui/components";

interface BreadcrumbsProps {
  pageTitle?: string;
  locale: string;
}

// Translation key mapping for breadcrumb items
const BREADCRUMB_TRANSLATIONS: Record<string, string> = {
  platform: "breadcrumbs.platform",
  experiments: "breadcrumbs.experiments",
  new: "breadcrumbs.new",
  edit: "breadcrumbs.edit",
  view: "breadcrumbs.view",
  account: "breadcrumbs.account",
  settings: "breadcrumbs.settings",
  protocols: "breadcrumbs.protocols",
  macros: "breadcrumbs.macros",
};

function getTitle(title: string, overrideTitle?: string, t?: (key: string) => string): string {
  if (overrideTitle) return overrideTitle;

  const translationKey = BREADCRUMB_TRANSLATIONS[title];
  if (translationKey && t) {
    return t(translationKey);
  }

  // Fallback to capitalize first letter
  return title.charAt(0).toUpperCase() + title.slice(1);
}

export function Breadcrumbs({ pageTitle, locale }: BreadcrumbsProps) {
  const { t } = useTranslation("common");
  const pathname = usePathname();

  const pathNames = pathname.split("/").filter((path) => path);
  // Remove the first item which is the locale (e.g., 'en-US', 'de-DE')
  // and the second item 'platform' since we show that as "Home"
  const pathNamesWithoutLocale = pathNames.slice(2);

  // Don't render breadcrumbs if there are no additional items beyond Home
  if (pathNamesWithoutLocale.length === 0) {
    return null;
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href={`/${locale}/platform`}>{t("breadcrumbs.home")}</BreadcrumbLink>
        </BreadcrumbItem>
        {pathNamesWithoutLocale.map((link, index) => {
          const href = `/${locale}/platform/${pathNamesWithoutLocale.slice(0, index + 1).join("/")}`;
          const title = getTitle(
            link,
            index === pathNamesWithoutLocale.length - 1 ? pageTitle : undefined,
            t,
          );

          return (
            <React.Fragment key={href}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href={href}>{title}</BreadcrumbLink>
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
