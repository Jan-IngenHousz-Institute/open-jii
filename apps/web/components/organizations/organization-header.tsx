"use client";

import { ExternalLink, Globe, Lock, MapPin, Users } from "lucide-react";

import type { OrganizationProfile } from "@repo/api/domains/organization/organization.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

import { OrganizationAvatar } from "./organization-avatar";
import { OrganizationInviteAction } from "./organization-invite-action";
import { OrganizationJoinCta } from "./organization-join-cta";
import { organizationRoleLabelKey, organizationTypeLabelKey } from "./organization-labels";
import { canManageRoster } from "./organization-roster-rules";

/**
 * The organization's identity, shown above every one of its routes: mark, name, the
 * two badges that say what it is to the caller, then a single meta line and the one
 * action the caller has here.
 *
 * The description is deliberately absent — it belongs to the About card on the
 * overview, where it has room to be read rather than clipped under the title. The
 * join affordance stays here rather than on the overview body so it is reachable
 * from wherever an outsider lands.
 */
export function OrganizationHeader({ organization }: { organization: OrganizationProfile }) {
  const { t } = useTranslation();

  const website = organization.website;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <OrganizationAvatar logo={organization.logo} name={organization.name} className="h-11 w-11" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-xl font-semibold tracking-tight">{organization.name}</h1>
          {organization.role ? (
            <Badge variant="outline" className="text-xs font-normal">
              {t(organizationRoleLabelKey(organization.role))}
            </Badge>
          ) : null}
          {organization.visibility === "public" ? (
            <Badge variant="secondary" className="text-xs font-normal">
              {t("organizations.visibility.publicBadge")}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-xs font-normal">
              <Lock className="h-3 w-3" aria-hidden />
              {t("organizations.visibility.privateLabel")}
            </Badge>
          )}
        </div>

        <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {organization.type ? <span>{t(organizationTypeLabelKey(organization.type))}</span> : null}
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" aria-hidden />
            {t("organizations.memberCount", { count: organization.memberCount })}
          </span>
          {organization.location ? (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {organization.location}
            </span>
          ) : null}
          {website ? (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary flex items-center gap-1.5 hover:underline"
            >
              <Globe className="h-3.5 w-3.5" aria-hidden />
              {t("organizations.fields.website")}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ) : null}
        </div>
      </div>

      {canManageRoster(organization.role) ? (
        // `role` is non-null whenever it manages; narrowed here rather than asserted.
        <OrganizationInviteAction
          organizationId={organization.id}
          actorRole={organization.role ?? "member"}
        />
      ) : (
        <OrganizationJoinCta
          organizationId={organization.id}
          organizationName={organization.name}
          membershipStatus={organization.membershipStatus}
        />
      )}
    </div>
  );
}
