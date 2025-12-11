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
  locale: string;
  pageTitle?: string;
}

// Translation mapping from old code
const BREADCRUMB_TRANSLATIONS: Record<string, string> = {
  platform: "breadcrumbs.platform",
  experiments: "breadcrumbs.experiments",
  new: "breadcrumbs.new",
  edit: "breadcrumbs.edit",
  view: "breadcrumbs.view",
  account: "breadcrumbs.account",
  settings: "breadcrumbs.settings",
};

function getTitle(title: string, overrideTitle?: string, t?: (key: string) => string): string {
  if (overrideTitle) return overrideTitle;

  const translationKey = BREADCRUMB_TRANSLATIONS[title];
  if (translationKey && t) {
    return t(translationKey);
  }

  // Default: Capitalize the segment
  return title.charAt(0).toUpperCase() + title.slice(1);
}

export function Breadcrumbs({ locale, pageTitle }: BreadcrumbsProps) {
  const pathname = usePathname();
  const { t } = useTranslation("common");

  const segments = pathname.split("/").filter(Boolean);
  const segmentsWithoutLocale = segments.slice(1);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href={`/${locale}/platform`}>{t("breadcrumbs.home")}</BreadcrumbLink>
        </BreadcrumbItem>

        {segmentsWithoutLocale.map((segment, index) => {
          const href = `/${locale}/${segmentsWithoutLocale.slice(0, index + 1).join("/")}`;

          const title = getTitle(
            segment,
            index === segmentsWithoutLocale.length - 1 ? pageTitle : undefined,
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
