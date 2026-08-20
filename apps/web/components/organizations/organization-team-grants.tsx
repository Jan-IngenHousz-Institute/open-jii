"use client";

import { useLocale } from "@/hooks/useLocale";
import type { LucideIcon } from "lucide-react";
import { BookOpen, Boxes, Code, FileSliders, Leaf, RadioReceiver } from "lucide-react";
import Link from "next/link";

import type { OrganizationTeamGrant } from "@repo/api/domains/organization/organization.schema";
import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Card } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";

import { RESOURCE_SEGMENT } from "./organization-resource-meta";

/**
 * The mark each grantable type already wears in the sidebar and the command palette.
 * Total, so a newly grantable type has to be given one rather than inheriting
 * another's. Local: one consumer.
 */
const RESOURCE_ICON: Record<SharingResourceType, LucideIcon> = {
  experiment: Leaf,
  protocol: FileSliders,
  macro: Code,
  workbook: BookOpen,
  device: RadioReceiver,
  device_group: Boxes,
};

/**
 * What a team reaches because the team itself was named on a grant — not what its
 * people reach in their own right, which is why deleting the team withdraws exactly
 * this list and nothing else.
 *
 * Read-only, like the roster's team badges: a grant is made and revoked on the
 * resource it is about, so this is a place to see the team's reach, not to change it.
 * Every row still links to the resource, devices included — a name you cannot click
 * reads as broken beside a showcase where you can, and following a grant to the thing
 * it is about is the obvious next move from here.
 */
export function OrganizationTeamGrants({
  grants,
  isPending = false,
  isError = false,
}: {
  grants: OrganizationTeamGrant[];
  /** An unread grant list is not an empty one — this page exists to audit the reach. */
  isPending?: boolean;
  isError?: boolean;
}) {
  const { t } = useTranslation();
  const locale = useLocale();

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
        <h3 id="organization-team-grants-title" className="text-sm font-semibold">
          {t("organizations.teams.grantsTitle")}
        </h3>
        <p className="text-muted-foreground text-xs">
          {t("organizations.teams.grantsDescription")}
        </p>
      </div>

      {isPending ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : isError ? (
        <p className="text-destructive text-sm">{t("organizations.teams.grantsLoadFailed")}</p>
      ) : grants.length === 0 ? (
        <Card className="text-muted-foreground bg-muted/40 px-5 py-6 text-center text-xs shadow-none">
          {t("organizations.teams.grantsEmpty")}
        </Card>
      ) : (
        <Card
          role="list"
          aria-labelledby="organization-team-grants-title"
          className="bg-muted/40 divide-border divide-y overflow-hidden shadow-none"
        >
          {grants.map((grant) => {
            const Icon = RESOURCE_ICON[grant.resourceType];
            return (
              <div role="listitem" key={grant.id} className="flex items-center gap-3 px-5 py-2.5">
                {/* Decorative: the row states the type in words on the right. */}
                <Icon className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden />
                {/* The name is always populated — an unnamed device arrives carrying its
                    thing name — and the link routes on the id either way, so a device
                    with no name of its own is still reachable from here. */}
                <Link
                  href={`/${locale}/platform/${RESOURCE_SEGMENT[grant.resourceType]}/${grant.resourceId}`}
                  className="min-w-0 flex-1 truncate text-sm hover:underline"
                >
                  {grant.resourceName}
                </Link>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {t(`organizations.delete.owned.${grant.resourceType}`, { count: 1 })}
                </span>
                <Badge variant="outline" className="shrink-0 text-xs font-normal">
                  {t(grantRoleLabelKey(grant.role))}
                </Badge>
              </div>
            );
          })}
        </Card>
      )}
    </section>
  );
}

/**
 * The two tiers a grant is made at, in the sharing surface's own words. `owner` is
 * read-only vocabulary — nothing mints it any more — but a row written before that
 * still has to render, and it confers the same control `admin` does.
 */
function grantRoleLabelKey(role: OrganizationTeamGrant["role"]): string {
  return role === "viewer" ? "sharing.roleCanView" : "sharing.roleCanEdit";
}
