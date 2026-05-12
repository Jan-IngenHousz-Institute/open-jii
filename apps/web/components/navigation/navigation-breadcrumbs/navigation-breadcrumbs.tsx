"use client";

import { iconMap } from "@/components/navigation/navigation-config";
import { useBreadcrumbs } from "@/hooks/breadcrumbs/useBreadcrumbs";
import { ChevronRight, type LucideIcon, Send } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

interface BreadcrumbsProps {
  locale: string;
}

// Maps the first URL segment to the sidebar icon for that section, so the
// breadcrumb's leading icon matches what the user clicked in the sidebar.
const SECTION_ICONS: Record<string, LucideIcon> = {
  experiments: iconMap.Leaf,
  "experiments-archive": iconMap.Archive,
  workbooks: iconMap.BookOpen,
  protocols: iconMap.FileSliders,
  macros: iconMap.Code,
  "transfer-request": Send,
  account: iconMap.User,
};

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
  const key = BREADCRUMB_TRANSLATIONS[segment];
  if (key) return t(key);
  if (segment.includes("-")) {
    return segment
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function Breadcrumbs({ locale }: BreadcrumbsProps) {
  const { t } = useTranslation("common");
  const { data: segments } = useBreadcrumbs(locale);

  // Reserve a constant 28px row so navigating between routes never shifts
  // the content below — even the platform root (which has no breadcrumb)
  // keeps the slot.
  return (
    <nav
      aria-label="breadcrumb"
      className="flex h-7 items-center text-sm text-muted-foreground"
    >
      {segments && segments.length > 0 ? (
        <ol className="flex flex-wrap items-center gap-1.5">
          {segments.map((item, index) => {
            const isLast = index === segments.length - 1;
            const title =
              item.title !== item.segment ? item.title : getTranslatedTitle(item.segment, t);
            const Icon = index === 0 ? SECTION_ICONS[item.segment] : undefined;

            return (
              <React.Fragment key={item.href}>
                {index !== 0 && (
                  <li role="presentation" aria-hidden="true" className="flex items-center">
                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
                  </li>
                )}
                <li className="inline-flex items-center gap-1.5">
                  {Icon && <Icon className="size-3.5 shrink-0 text-muted-foreground" />}
                  {isLast ? (
                    <span
                      aria-current="page"
                      className="font-medium text-foreground"
                    >
                      {title}
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      className={cn(
                        "transition-colors hover:text-foreground",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:rounded-sm",
                      )}
                    >
                      {title}
                    </Link>
                  )}
                </li>
              </React.Fragment>
            );
          })}
        </ol>
      ) : null}
    </nav>
  );
}
