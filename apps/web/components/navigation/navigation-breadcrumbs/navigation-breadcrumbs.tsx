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

import { useBreadcrumbContext } from "../breadcrumb-context";

interface BreadcrumbsProps {
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

function getTitle(title: string, t?: (key: string) => string): string {
  const translationKey = BREADCRUMB_TRANSLATIONS[title];
  if (translationKey && t) {
    return t(translationKey);
  }

  // Fallback to capitalize first letter
  return title.charAt(0).toUpperCase() + title.slice(1);
}

export function Breadcrumbs({ locale }: BreadcrumbsProps) {
  const { t } = useTranslation("common");
  const pathname = usePathname();
  const { nameMappings } = useBreadcrumbContext();

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const pathNames = pathname.split("/").filter((path) => path);
  // Remove the first item which is the locale (e.g., 'en-US', 'de-DE')
  // and the second item 'platform' since we don't show it in breadcrumbs

  let pathNamesWithoutLocale = pathNames.slice(2);

  // Find the first UUID in the path
  const uuidIndex = pathNamesWithoutLocale.findIndex((segment) => UUID_REGEX.test(segment));

  // Prevents tab routes from appearing in breadcrumbs
  if (uuidIndex !== -1) {
    pathNamesWithoutLocale = pathNamesWithoutLocale.slice(0, uuidIndex + 1);
  }

  // Do not render breadcrumbs for first level routes (e.g. /platform/experiments)
  if (pathNamesWithoutLocale.length <= 1) {
    return null;
  }

  return (
    <Breadcrumb className="pb-6">
      <BreadcrumbList>
        {pathNamesWithoutLocale.map((link, index) => {
          const href = `/${locale}/platform/${pathNamesWithoutLocale.slice(0, index + 1).join("/")}`;

          // Check if this segment is a UUID and has a mapping
          let title: string;
          if (UUID_REGEX.test(link) && nameMappings[link]) {
            title = nameMappings[link];
          } else {
            title = getTitle(link, t);
          }

          return (
            <React.Fragment key={href}>
              {index !== 0 && <BreadcrumbSeparator />}
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
