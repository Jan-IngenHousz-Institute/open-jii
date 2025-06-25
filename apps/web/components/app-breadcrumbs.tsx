import React from "react";

import type { Locale } from "@repo/i18n/config";
import initTranslations from "@repo/i18n/server";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@repo/ui/components";

interface BreadcrumbsProps {
  pathname: string;
  pageTitle?: string;
  locale: Locale;
}

// Translation key mapping for breadcrumb items
const BREADCRUMB_TRANSLATIONS: Record<string, string> = {
  platform: "breadcrumbs.platform",
  experiments: "breadcrumbs.experiments",
  new: "breadcrumbs.new",
  edit: "breadcrumbs.edit",
  view: "breadcrumbs.view",
};

function getTitle(title: string, overrideTitle?: string, t?: (key: string) => string): string {
  if (overrideTitle) return overrideTitle;

  const translationKey = BREADCRUMB_TRANSLATIONS[title];
  if (translationKey && t) {
    return translationKey.startsWith("breadcrumbs.") ? t(translationKey) : translationKey;
  }

  // Fallback to capitalize first letter
  return title.charAt(0).toUpperCase() + title.slice(1);
}

export async function Breadcrumbs({ pathname, pageTitle, locale }: BreadcrumbsProps) {
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  const pathNames = pathname.split("/").filter((path) => path);
  // Remove the first item which is the locale (e.g., 'en-US', 'de-DE')
  const pathNamesWithoutLocale = pathNames.slice(1);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href={`/${locale}/platform`}>{t("breadcrumbs.home")}</BreadcrumbLink>
        </BreadcrumbItem>
        {pathNamesWithoutLocale.map((link, index) => {
          const href = `/${locale}/${pathNamesWithoutLocale.slice(0, index + 1).join("/")}`;
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
