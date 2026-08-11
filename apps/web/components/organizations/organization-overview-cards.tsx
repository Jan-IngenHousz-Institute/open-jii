"use client";

import { VisibilityBadge } from "@/components/visibility/visibility-badge";
import type { OrganizationListItem } from "@/hooks/organization/useOrganizationsList/useOrganizationsList";
import { useLocale } from "@/hooks/useLocale";
import { ChevronRight, FolderOpen, Users } from "lucide-react";
import Link from "next/link";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { RichTextRenderer } from "@repo/ui/components/rich-text-renderer";
import { Skeleton } from "@repo/ui/components/skeleton";

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

  if (isPending) {
    return (
      <div aria-busy="true" className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-48" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {organizations.map((organization) => (
        <Link key={organization.id} href={organizationPath(locale, organization.id)}>
          <div className="relative flex h-full min-h-[180px] flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 transition-all hover:scale-[1.02] hover:shadow-lg">
            <div className="mb-auto">
              {/* The badge shares the title's line rather than floating over the
                  corner, so a title long enough to wrap cannot run under it.
                  Only when private: "public" is the unremarkable default. */}
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="line-clamp-2 break-words text-base font-semibold text-gray-900 md:text-lg">
                  {organization.name}
                </h3>
                <VisibilityBadge
                  visibility={organization.visibility}
                  privateOnly
                  className="shrink-0"
                />
              </div>
              <div className="overflow-hidden text-sm text-gray-500">
                {/* Empty rather than blank, so a description-less organization gets
                    the shared placeholder instead of an empty line. */}
                <RichTextRenderer content={organization.description ?? ""} truncate maxLines={2} />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-1">
              <Badge variant="secondary" className="gap-1 font-normal">
                <Users className="h-3 w-3" aria-hidden />
                {t("organizations.memberCount", { count: organization.memberCount })}
              </Badge>
              <Badge variant="secondary" className="gap-1 font-normal">
                <FolderOpen className="h-3 w-3" aria-hidden />
                {t("organizations.resourceCount", { count: organization.resourceCount })}
              </Badge>
            </div>
            <ChevronRight className="absolute bottom-5 right-5 h-6 w-6 text-gray-900 md:hidden" />
          </div>
        </Link>
      ))}
    </div>
  );
}
