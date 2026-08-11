"use client";

import { ExternalLink, Globe, MapPin, Users } from "lucide-react";

import type { OrganizationProfile } from "@repo/api/domains/organization/organization.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

import { OrganizationAvatar } from "./organization-avatar";
import { OrganizationJoinCta } from "./organization-join-cta";
import { organizationRoleLabelKey, organizationTypeLabelKey } from "./organization-labels";

/**
 * The organization's identity card, shown above every one of its routes. The
 * join affordance lives here rather than on the overview body so it stays reachable
 * from wherever an outsider lands.
 */
export function OrganizationHeader({ organization }: { organization: OrganizationProfile }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <OrganizationAvatar logo={organization.logo} name={organization.name} className="h-14 w-14" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{organization.name}</h1>
          {organization.role ? (
            <Badge variant="outline" className="text-xs font-normal">
              {t(organizationRoleLabelKey(organization.role))}
            </Badge>
          ) : null}
          {organization.visibility === "public" ? (
            <Badge variant="secondary" className="text-xs font-normal">
              {t("organizations.visibility.publicBadge")}
            </Badge>
          ) : null}
        </div>

        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {organization.type ? <span>{t(organizationTypeLabelKey(organization.type))}</span> : null}
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {t("organizations.memberCount", { count: organization.memberCount })}
          </span>
          {organization.location ? (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {organization.location}
            </span>
          ) : null}
          {organization.website ? (
            <a
              href={organization.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 underline underline-offset-2"
            >
              <Globe className="h-3.5 w-3.5" />
              {t("organizations.fields.website")}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>

        {organization.description ? (
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
            {organization.description}
          </p>
        ) : null}
      </div>

      <OrganizationJoinCta
        organizationId={organization.id}
        organizationName={organization.name}
        membershipStatus={organization.membershipStatus}
      />
    </div>
  );
}
