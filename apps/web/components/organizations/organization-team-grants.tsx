"use client";

import { useLocale } from "@/hooks/useLocale";
import Link from "next/link";

import type { OrganizationTeamGrant } from "@repo/api/domains/organization/organization.schema";
import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Card } from "@repo/ui/components/card";

/**
 * Where each grantable type lives on the platform. Five, not the showcase's four:
 * a team can hold a grant on a device, and a device has a detail page like the rest.
 */
const RESOURCE_SEGMENT: Record<SharingResourceType, string> = {
  experiment: "experiments",
  protocol: "protocols",
  macro: "macros",
  workbook: "workbooks",
  device: "devices",
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
export function OrganizationTeamGrants({ grants }: { grants: OrganizationTeamGrant[] }) {
  const { t } = useTranslation();
  const locale = useLocale();

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
        <h3 className="text-sm font-semibold">{t("organizations.teams.grantsTitle")}</h3>
        <p className="text-muted-foreground text-xs">
          {t("organizations.teams.grantsDescription")}
        </p>
      </div>

      {grants.length === 0 ? (
        <Card className="text-muted-foreground bg-muted/40 px-5 py-6 text-center text-xs shadow-none">
          {t("organizations.teams.grantsEmpty")}
        </Card>
      ) : (
        <Card
          role="list"
          className="bg-muted/40 divide-border divide-y overflow-hidden shadow-none"
        >
          {grants.map((grant) => (
            <div role="listitem" key={grant.id} className="flex items-center gap-3 px-5 py-2.5">
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
          ))}
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
