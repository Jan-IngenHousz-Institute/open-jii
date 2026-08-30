"use client";

import { Archive, ArrowRightLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Separator } from "@repo/ui/components/separator";
import { SidebarTrigger } from "@repo/ui/components/sidebar";

import { mainNavigation, userNavigation } from "../navigation-config";
import type { NavLink } from "../navigation-config";
import { usePlatformHeaderDetail } from "./platform-header-context";
import {
  OPEN_DEVICE_BULK_REGISTER_EVENT,
  OPEN_DEVICE_REGISTER_EVENT,
  OPEN_WORKBOOK_CREATE_EVENT,
} from "./platform-header-events";
import type { PlatformHeaderEvent } from "./platform-header-events";

interface SectionCandidate {
  url: string;
  titleKey: string;
  namespace?: string;
  exact?: boolean;
}

/**
 * One label per sidebar destination: the top-level rows, the library children
 * (protocols/macros), and account. The header shows the section, not the page —
 * detail routes keep their section label rather than fetching a resource name.
 */
function sectionCandidates(locale: string): SectionCandidate[] {
  const candidates: SectionCandidate[] = [];
  const entries: NavLink[] = Object.values(mainNavigation);
  for (const nav of entries) {
    if (nav.navigable === false && nav.children && nav.children.length > 0) {
      for (const child of nav.children) {
        candidates.push({
          url: child.url(locale),
          titleKey: child.titleKey,
          namespace: child.namespace,
        });
      }
    } else {
      candidates.push({
        url: nav.url(locale),
        titleKey: nav.titleKey,
        namespace: nav.namespace,
        exact: nav === mainNavigation.dashboard,
      });
    }
  }
  candidates.push({
    url: userNavigation.account.url(locale),
    titleKey: userNavigation.account.titleKey,
    namespace: userNavigation.account.namespace,
  });
  candidates.push(
    {
      url: `/${locale}/platform/experiments-archive`,
      titleKey: "experiments.archiveTitle",
      namespace: "common",
    },
    {
      url: `/${locale}/platform/transfer-request`,
      titleKey: "transferRequest.title",
      namespace: "common",
    },
  );
  return candidates;
}

/**
 * Compact shell header: clickable section/entity breadcrumbs on the left and
 * route-wide quick/create actions on the right. Search and filters stay beside
 * the collection they operate on instead of competing with page navigation.
 */
export function SiteHeader({ locale }: { locale: string }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const detailBreadcrumb = usePlatformHeaderDetail();

  const matches = sectionCandidates(locale).filter(
    (candidate) =>
      pathname === candidate.url || (!candidate.exact && pathname.startsWith(candidate.url + "/")),
  );
  const best = matches.sort((a, b) => b.url.length - a.url.length).at(0);
  const label = best ? t(best.titleKey, { ns: best.namespace }) : null;
  const actions = overviewActions(pathname, locale, t);

  return (
    <header
      className="bg-background before:bg-background sticky z-40 flex h-12 w-full shrink-0 items-center gap-2 border-b px-4 before:absolute before:inset-x-0 before:-top-2 before:h-2 before:content-['']"
      style={{
        top: "calc(var(--banner-offset, 0px) + var(--sidebar-inset-offset, 0px))",
      }}
    >
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-4" />
      {label && best && (
        <nav aria-label={t("navigation.breadcrumbs")} className="flex min-w-0 items-center gap-1">
          {detailBreadcrumb ? (
            <Link
              href={best.url}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring truncate rounded-sm text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
            >
              {label}
            </Link>
          ) : (
            <h1 className="min-w-0 text-sm font-medium">
              <Link
                href={best.url}
                className="hover:text-foreground focus-visible:ring-ring block truncate rounded-sm focus-visible:outline-none focus-visible:ring-2"
              >
                {label}
              </Link>
            </h1>
          )}
          {detailBreadcrumb && (
            <>
              <ChevronRight className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 max-w-48 text-sm font-medium md:max-w-80">
                <Link
                  href={detailBreadcrumb.href}
                  title={detailBreadcrumb.label}
                  aria-current="page"
                  className="hover:text-foreground focus-visible:ring-ring block truncate rounded-sm focus-visible:outline-none focus-visible:ring-2"
                >
                  {detailBreadcrumb.label}
                </Link>
              </span>
            </>
          )}
        </nav>
      )}
      {actions && <div className="ml-auto flex shrink-0 items-center gap-1.5">{actions}</div>}
    </header>
  );
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

function dispatch(name: PlatformHeaderEvent) {
  window.dispatchEvent(new Event(name));
}

function CreateAction({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild size="sm" title={label}>
      <Link href={href} aria-label={label}>
        <Plus className="size-4" aria-hidden />
        <span className="hidden sm:inline">{label}</span>
      </Link>
    </Button>
  );
}

function EventCreateAction({ event, label }: { event: PlatformHeaderEvent; label: string }) {
  return (
    <Button size="sm" title={label} aria-label={label} onClick={() => dispatch(event)}>
      <Plus className="size-4" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

function overviewActions(pathname: string, locale: string, t: Translate) {
  if (pathname === `/${locale}/platform/experiments`) {
    const archiveLabel = t("experiments.viewArchived", { ns: "experiments" });
    const transferLabel = t("transferRequest.title");
    return (
      <>
        <Button asChild variant="ghost" size="sm" title={archiveLabel}>
          <Link href={`/${locale}/platform/experiments-archive`} aria-label={archiveLabel}>
            <Archive className="size-4" aria-hidden />
            <span className="hidden lg:inline">{archiveLabel}</span>
          </Link>
        </Button>
        <Button asChild variant="secondary" size="sm" title={transferLabel}>
          <Link href={`/${locale}/platform/transfer-request`} aria-label={transferLabel}>
            <ArrowRightLeft className="size-4" aria-hidden />
            <span className="hidden md:inline">{transferLabel}</span>
          </Link>
        </Button>
        <CreateAction
          href={`/${locale}/platform/experiments/new`}
          label={t("experiments.create", { ns: "experiments" })}
        />
      </>
    );
  }

  if (pathname === `/${locale}/platform/protocols`) {
    return (
      <CreateAction href={`/${locale}/platform/protocols/new`} label={t("protocols.create")} />
    );
  }

  if (pathname === `/${locale}/platform/macros`) {
    return (
      <CreateAction
        href={`/${locale}/platform/macros/new`}
        label={t("macros.create", { ns: "macro" })}
      />
    );
  }

  if (pathname === `/${locale}/platform/workbooks`) {
    return (
      <EventCreateAction
        event={OPEN_WORKBOOK_CREATE_EVENT}
        label={t("workbooks.create", { ns: "workbook" })}
      />
    );
  }

  if (pathname === `/${locale}/platform/organizations`) {
    return (
      <CreateAction
        href={`/${locale}/platform/organizations/new`}
        label={t("organizations.createAction")}
      />
    );
  }

  if (pathname === `/${locale}/platform/devices`) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          className="hidden md:inline-flex"
          aria-label={t("iot.devices.bulkDialog.open", { ns: "iot" })}
          onClick={() => dispatch(OPEN_DEVICE_BULK_REGISTER_EVENT)}
        >
          <Plus className="size-4" aria-hidden />
          {t("iot.devices.bulkDialog.open", { ns: "iot" })}
        </Button>
        <EventCreateAction
          event={OPEN_DEVICE_REGISTER_EVENT}
          label={t("iot.devices.register", { ns: "iot" })}
        />
      </>
    );
  }

  return null;
}
