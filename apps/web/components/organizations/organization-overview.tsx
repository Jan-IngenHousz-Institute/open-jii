"use client";

import { DocsHelpLink } from "@/components/docs-help-link";
import { useOrganization } from "@/hooks/organization/useOrganization/useOrganization";
import { useOrganizationResources } from "@/hooks/organization/useOrganizationResources/useOrganizationResources";
import { useOrganizationTeams } from "@/hooks/organization/useOrganizationTeams/useOrganizationTeams";
import { FolderOpen, Info, Network, Users } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Card } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";

import { OrganizationAboutCard } from "./organization-about-card";
import { OrganizationResourceRows } from "./organization-resource-rows";
import { OrganizationStatTile } from "./organization-stat-tile";

/**
 * The organization's front page: what it owns on the left, what it is on the right.
 *
 * The resources are scoped server-side by what the caller may read — an outsider on
 * a public organization sees its public work, a member sees everything they have
 * access to. The client draws no distinction; there is nothing here it could filter
 * that the server has not already decided.
 *
 * The sidebar carries About *and* the counts rather than the counts running across
 * the top: with three tiles instead of four and no activity feed under About, a
 * separate tile row would leave the right-hand column stranded beside a long
 * resources card. They are all facts about the organization, so they read as one
 * column.
 */
export function OrganizationOverview({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation();

  const { data: organization } = useOrganization(organizationId);
  const { data, isPending, isError } = useOrganizationResources(organizationId);

  const isMember = organization?.role != null;
  // Members only, like the endpoint behind it — an outsider gets no teams tile
  // rather than a tile that would have to guess.
  const { data: teams } = useOrganizationTeams(organizationId, { enabled: isMember });

  const resources = data?.resources ?? [];

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
        {organization && !isMember ? (
          <Card className="text-muted-foreground flex items-start gap-3 p-4 text-sm">
            <Info className="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p className="leading-relaxed">{t("organizations.overview.visitorNotice")}</p>
          </Card>
        ) : null}

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
            <OrganizationResourceRows resources={data.resources} totals={data.totals} />
          )}
        </Card>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        {organization ? <OrganizationAboutCard organization={organization} /> : null}

        {organization && isMember ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <OrganizationStatTile
              label={t("organizations.tabs.members")}
              value={organization.memberCount}
              icon={Users}
            />
            <OrganizationStatTile
              label={t("organizations.tabs.teams")}
              value={teams?.length ?? 0}
              icon={Network}
            />
            <OrganizationStatTile
              label={t("organizations.resources.title")}
              value={organization.resourceCount}
              icon={FolderOpen}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
