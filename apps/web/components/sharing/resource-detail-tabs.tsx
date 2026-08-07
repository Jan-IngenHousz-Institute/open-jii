"use client";

import { useLocale } from "@/hooks/useLocale";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";
import { useTranslation } from "@repo/i18n";
import { NavTabs, NavTabsList, NavTabsTrigger } from "@repo/ui/components/nav-tabs";

import { resourceCollaboratorsPath, resourceDetailPath } from "./resource-routes";

interface ResourceDetailTabsProps {
  resourceType: SharingResourceType;
  resourceId: string;
  /** `can(share)` from the detail response — earns the full collaborators route. */
  canShare: boolean;
  /** Below `share`, this route is still the only place to give up a direct grant. */
  canLeave?: boolean;
  children: React.ReactNode;
}

/**
 * Making collaborators a route swaps the entire detail surface, rather than
 * conditionally hiding editors and metadata, and preserves links/history. Readers
 * with neither share nor leave access get bare content instead of a lone tab.
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
  const activeTab = pathname.endsWith("/collaborators") ? "collaborators" : "overview";

  return (
    <NavTabs value={activeTab} className="flex w-full flex-1 flex-col">
      <NavTabsList>
        <NavTabsTrigger value="overview" asChild>
          <Link href={detailPath}>{t("common.overview")}</Link>
        </NavTabsTrigger>
        <NavTabsTrigger value="collaborators" asChild>
          <Link href={resourceCollaboratorsPath(locale, resourceType, resourceId)}>
            {t("sharing.collaboratorsTab")}
          </Link>
        </NavTabsTrigger>
      </NavTabsList>

      <div className="mt-6 flex flex-1 flex-col">{children}</div>
    </NavTabs>
  );
}
