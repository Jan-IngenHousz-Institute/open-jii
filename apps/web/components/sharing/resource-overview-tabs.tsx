"use client";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";
import { useTranslation } from "@repo/i18n";
import { NavTabs, NavTabsContent, NavTabsList, NavTabsTrigger } from "@repo/ui/components/nav-tabs";
import { cn } from "@repo/ui/lib/utils";

import { LeaveResourceCard } from "./leave-resource-card";
import { ResourceCollaborators } from "./resource-collaborators";

interface ResourceOverviewTabsProps {
  resourceType: SharingResourceType;
  resourceId: string;
  /** `can(share)` from the detail response — grants the full collaborators tab. */
  canShare: boolean;
  /**
   * `capabilities.canLeave` from the detail response. Without `share` it still
   * earns a Collaborators tab, holding only the self-leave card — a grantee
   * below `share` has no other surface to give up their access from.
   */
  canLeave?: boolean;
  readOnly?: boolean;
  /** Classes for the wrapper, so a host keeps its own page layout. */
  className?: string;
  /** Classes for the overview pane, so a host keeps its own content spacing. */
  overviewClassName?: string;
  children: React.ReactNode;
}

/**
 * Overview / Collaborators tabs for a macro, protocol or workbook detail page.
 *
 * Sharing is a surface of its own rather than a card appended under the content,
 * which is what keeps every resource type's collaborator management in one
 * recognizable place. A reader with neither `share` nor a grant of their own has
 * nothing to put in a second tab, so for them the overview renders bare — no
 * lone tab strip. A non-share grantee (`canLeave`) gets the tab with just the
 * leave card.
 */
export function ResourceOverviewTabs({
  resourceType,
  resourceId,
  canShare,
  canLeave = false,
  readOnly = false,
  className,
  overviewClassName,
  children,
}: ResourceOverviewTabsProps) {
  const { t } = useTranslation();

  if (!canShare && !canLeave) {
    return <div className={cn(className, overviewClassName)}>{children}</div>;
  }

  return (
    <div className={className}>
      <NavTabs defaultValue="overview" className="w-full">
        <NavTabsList>
          <NavTabsTrigger value="overview">{t("common.overview")}</NavTabsTrigger>
          <NavTabsTrigger value="collaborators">{t("sharing.collaboratorsTab")}</NavTabsTrigger>
        </NavTabsList>

        <NavTabsContent value="overview" className={cn("mt-6", overviewClassName)}>
          {children}
        </NavTabsContent>

        <NavTabsContent value="collaborators" className="mt-6">
          {canShare ? (
            <ResourceCollaborators
              resourceType={resourceType}
              resourceId={resourceId}
              canShare
              readOnly={readOnly}
            />
          ) : (
            <LeaveResourceCard
              resourceType={resourceType}
              resourceId={resourceId}
              disabled={readOnly}
            />
          )}
        </NavTabsContent>
      </NavTabs>
    </div>
  );
}
