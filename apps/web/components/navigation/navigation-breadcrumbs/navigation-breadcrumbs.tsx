"use client";

import { useBreadcrumbs } from "@/hooks/breadcrumbs/useBreadcrumbs";
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

function getTranslatedTitle(segment: string, t: (key: string) => string): string {
  const translationKey = BREADCRUMB_TRANSLATIONS[segment];
  if (translationKey) {
    return t(translationKey);
  }

  // Handle segments with dashes - convert to title case
  if (segment.includes("-")) {
    return segment
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  // Fallback to capitalize first letter
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function Breadcrumbs({ locale }: BreadcrumbsProps) {
  const { t } = useTranslation("common");
  const { data: segments } = useBreadcrumbs(locale);

  // Don't render if no segments
  if (!segments || segments.length === 0) {
    return null;
  }

  return (
    <Breadcrumb className="pb-6">
      <BreadcrumbList>
        {segments.map((item, index) => {
          // Use the enriched title if available, otherwise translate the segment
          const title =
            item.title !== item.segment ? item.title : getTranslatedTitle(item.segment, t);

          return (
            <React.Fragment key={item.href}>
              {index !== 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                <BreadcrumbLink href={item.href}>{title}</BreadcrumbLink>
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
