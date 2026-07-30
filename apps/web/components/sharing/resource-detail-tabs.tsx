"use client";

import { useLocale } from "@/hooks/useLocale";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";
import { useTranslation } from "@repo/i18n";
import { NavTabs, NavTabsList, NavTabsTrigger } from "@repo/ui/components/nav-tabs";

import { resourceDetailPath } from "./resource-routes";

interface ResourceDetailTabsProps {
  resourceType: SharingResourceType;
  resourceId: string;
  /** `can(share)` from the detail response — earns the full collaborators route. */
  canShare: boolean;
  /**
   * `capabilities.canLeave` from the detail response. Without `share` it still
   * earns the Collaborators tab, holding only the self-leave card — a grantee
   * below `share` has no other surface to give up their access from.
   */
  canLeave?: boolean;
  children: React.ReactNode;
}

/**
 * Overview / Collaborators strip for a macro, protocol or workbook detail page —
 * the same shape experiments have, and route-linked for the same reason.
 *
 * Sharing being a route rather than in-page tab state is what makes the switch
 * swap the *whole* surface: the details sidebar, the description and the editor
 * belong to the Overview route, so on Collaborators they are simply not
 * rendered, with no page having to hide them. It also makes the surface
 * linkable and the back button work.
 *
 * A reader with neither `share` nor a grant of their own has nothing to put in a
 * second tab, so for them the content renders bare — a lone "Overview" tab is
 * not a strip worth showing.
 */
export function ResourceDetailTabs({
  resourceType,
  resourceId,
  canShare,
  canLeave = false,
  children,
}: ResourceDetailTabsProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const locale = useLocale();

  if (!canShare && !canLeave) {
    return <>{children}</>;
  }

  const detailPath = resourceDetailPath(locale, resourceType, resourceId);
  // Read off the URL rather than kept in state: the route is the source of truth,
  // so a direct visit and the back button both land on the right tab.
  const activeTab = pathname.endsWith("/collaborators") ? "collaborators" : "overview";

  return (
    <NavTabs value={activeTab} className="flex w-full flex-1 flex-col">
      <NavTabsList>
        <NavTabsTrigger value="overview" asChild>
          <Link href={detailPath}>{t("common.overview")}</Link>
        </NavTabsTrigger>
        <NavTabsTrigger value="collaborators" asChild>
          <Link href={`${detailPath}/collaborators`}>{t("sharing.collaboratorsTab")}</Link>
        </NavTabsTrigger>
      </NavTabsList>

      <div className="mt-6 flex flex-1 flex-col">{children}</div>
    </NavTabs>
  );
}
