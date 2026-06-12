"use client";

import { iconMap } from "@/components/navigation/navigation-config";
import { useBreadcrumbs } from "@/hooks/breadcrumbs/useBreadcrumbs";
import { ChevronRight, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

// Breadcrumb targets are always internal platform paths derived from the
// current URL. Guard against any value that could escape the origin — a
// protocol-relative (`//host`), backslash (`/\host`), or absolute URL — before
// using it as a navigation target.
function toInternalHref(href: string): string {
  if (href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/\\")) {
    return href;
  }
  return "/";
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
      className="text-muted-foreground flex min-h-7 items-center text-sm"
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
                    <ChevronRight className="text-muted-foreground/60 size-3.5 shrink-0" />
                  </li>
                )}
                <li className="inline-flex items-center gap-1.5">
                  {Icon && <Icon className="text-muted-foreground size-3.5 shrink-0" />}
                  {isLast ? (
                    <span aria-current="page" className="text-foreground font-medium">
                      {title}
                    </span>
                  ) : (
                    <Link
                      href={toInternalHref(item.href)}
                      className={cn(
                        "hover:text-foreground transition-colors",
                        "focus-visible:ring-ring focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
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
