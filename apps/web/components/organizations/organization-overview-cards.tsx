"use client";

import { ResourceCard, ResourceCardGrid } from "@/components/shared/resource-card";
import { VisibilityBadge } from "@/components/visibility/visibility-badge";
import type { OrganizationListItem } from "@/hooks/organization/useOrganizationsList/useOrganizationsList";
import { useLocale } from "@/hooks/useLocale";
import { FolderOpen, Users } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { RichTextRenderer } from "@repo/ui/components/rich-text-renderer";

import { organizationPath } from "./organization-routes";

/**
 * The organizations grid, in the card idiom the experiments, macros and protocols
 * listings share: the whole card is the link to the organization, and the counts
 * ride as pills where those cards put their footer line.
 *
 * No in-card action, for the same reason those cards have none — the affordances
 * an organization offers a visitor (asking to join, withdrawing the ask) live on
 * the organization's own header, which is one tap away.
 */
export function OrganizationOverviewCards({
  organizations,
  isPending,
}: {
  organizations: OrganizationListItem[];
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const locale = useLocale();

  return (
    <ResourceCardGrid isLoading={isPending}>
      {organizations.map((organization) => (
        <ResourceCard
          key={organization.id}
          href={organizationPath(locale, organization.id)}
          title={organization.name}
          // Only when private: "public" is the unremarkable default.
          badges={<VisibilityBadge visibility={organization.visibility} privateOnly />}
          extra={
            <div className="mt-4 flex flex-wrap items-center gap-1">
              <Badge variant="secondary" className="gap-1 font-normal">
                <Users className="h-3 w-3" aria-hidden />
                {t("organizations.memberCount", { count: organization.memberCount })}
              </Badge>
              <Badge variant="secondary" className="gap-1 font-normal">
                <FolderOpen className="h-3 w-3" aria-hidden />
                {/* Qualified for a non-member: the count is access-scoped. Not "public"
                    (it includes granted rows) and no denominator (that gap is the private
                    estate's size). */}
                {organization.isMember
                  ? t("organizations.resourceCount", { count: organization.resourceCount })
                  : t("organizations.visibleResourceCount", {
                      count: organization.resourceCount,
                    })}
              </Badge>
            </div>
          }
        >
          {/* Empty rather than blank, so a description-less organization gets
              the shared placeholder instead of an empty line. */}
          <RichTextRenderer content={organization.description ?? ""} truncate maxLines={2} />
        </ResourceCard>
      ))}
    </ResourceCardGrid>
  );
}
