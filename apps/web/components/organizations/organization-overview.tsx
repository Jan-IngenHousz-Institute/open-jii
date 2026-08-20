"use client";

import { DocsHelpLink } from "@/components/docs-help-link";
import { useOrganization } from "@/hooks/organization/useOrganization/useOrganization";
import { useOrganizationMembers } from "@/hooks/organization/useOrganizationMembers/useOrganizationMembers";
import { useOrganizationResources } from "@/hooks/organization/useOrganizationResources/useOrganizationResources";
import { useOrganizationTeams } from "@/hooks/organization/useOrganizationTeams/useOrganizationTeams";
import { FolderOpen, Info } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Card } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";

import { OrganizationAboutCard } from "./organization-about-card";
import { OrganizationFeaturedResources } from "./organization-featured-resources";
import { OrganizationResourceMix } from "./organization-resource-mix";
import { OrganizationResourceRows } from "./organization-resource-rows";

/**
 * The organization's front page: what it owns on the left, what it is on the right.
 *
 * The resources are scoped server-side by what the caller may read — an outsider on
 * a public organization sees its public work, a member sees everything they have
 * access to. The client draws no distinction; there is nothing here it could filter
 * that the server has not already decided.
 *
 * The sidebar carries About, who is in the organization and the shape of its estate,
 * rather than a row of counts across the top — all facts about the organization, so
 * they read as one column.
 */
export function OrganizationOverview({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation();

  const { data: organization } = useOrganization(organizationId);
  const { data, isPending, isError } = useOrganizationResources(organizationId);

  const isMember = organization?.role != null;
  // One answer for the page: every row is owned by this one organization.
  const canTransfer = organization?.role === "owner" || organization?.role === "admin";
  // Members only, like the endpoints behind them.
  const { data: teams, isPending: isTeamsPending } = useOrganizationTeams(organizationId, {
    enabled: isMember,
  });
  const { data: roster, isPending: isMembersPending } = useOrganizationMembers(organizationId, {
    enabled: isMember,
  });

  const resources = data?.resources ?? [];

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
        {organization && !isMember ? (
          <Card className="text-muted-foreground flex items-start gap-3 p-4 text-sm">
            <Info className="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p className="leading-relaxed">{t("organizations.overview.visitorNotice")}</p>
          </Card>
        ) : null}

        <OrganizationFeaturedResources resources={resources} />

        <Card className="p-5">
          <div className="mb-4 space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">
              {t("organizations.resources.title")}
            </h2>
            <p className="text-muted-foreground text-sm">
              {isMember
                ? t("organizations.resources.memberDescription")
                : t("organizations.resources.visitorDescription")}
            </p>
            <DocsHelpLink path="/guide/organizations" className="mt-1" />
          </div>

          {isError ? (
            <p className="text-destructive text-sm">{t("organizations.resources.loadFailed")}</p>
          ) : isPending ? (
            <div aria-busy="true" className="flex flex-col gap-3">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center gap-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-56" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : resources.length === 0 ? (
            <div className="py-8 text-center">
              <div className="text-muted-foreground bg-muted mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full">
                <FolderOpen className="h-5 w-5" aria-hidden />
              </div>
              <p className="text-foreground text-sm font-semibold">
                {t("organizations.resources.emptyTitle")}
              </p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-[380px] text-xs leading-relaxed">
                {isMember
                  ? t("organizations.resources.emptyMemberHint")
                  : t("organizations.resources.emptyVisitorHint")}
              </p>
            </div>
          ) : (
            // Neither pending nor errored, so the query has narrowed `data`.
            <OrganizationResourceRows
              resources={data.resources}
              transfer={canTransfer ? { organizationId } : undefined}
            />
          )}
        </Card>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        {organization ? (
          <OrganizationAboutCard
            organization={organization}
            members={roster?.members}
            teams={teams}
            isMembersPending={isMember && isMembersPending}
            isTeamsPending={isMember && isTeamsPending}
          />
        ) : null}

        {data ? <OrganizationResourceMix totals={data.totals} isMember={isMember} /> : null}
      </div>
    </div>
  );
}
