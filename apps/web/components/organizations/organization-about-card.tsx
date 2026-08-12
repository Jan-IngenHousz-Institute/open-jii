"use client";

import { useLocale } from "@/hooks/useLocale";
import { ExternalLink } from "lucide-react";

import type {
  OrganizationMember,
  OrganizationProfile,
  OrganizationTeam,
} from "@repo/api/domains/organization/organization.schema";
import { useTranslation } from "@repo/i18n";
import { Card } from "@repo/ui/components/card";
import { RichTextRenderer } from "@repo/ui/components/rich-text-renderer";

import { OrganizationAvatarTrail, teamAsTrailFace } from "./organization-avatar-trail";
import { organizationTypeLabelKey } from "./organization-labels";
import { organizationMembersPath, organizationTeamsPath } from "./organization-routes";

interface OrganizationAboutCardProps {
  organization: OrganizationProfile;
  /** Member-only reads, so both are absent for a visitor and while either is in flight. */
  members?: OrganizationMember[];
  teams?: OrganizationTeam[];
  isMembersPending?: boolean;
  isTeamsPending?: boolean;
}

/**
 * What the organization says about itself, plus the handful of facts a visitor
 * deciding whether to ask to join actually wants. The description lives here rather
 * than in the header band because here it has room to be read.
 *
 * Who is in it lives here too, as two more entries rather than as tiles above — a face
 * says more about a roster than a number does. Member-only, matching the teams
 * endpoint.
 *
 * A row is present only when the field is set: an unfilled profile should read as a
 * short one, not as a list of blanks.
 */
export function OrganizationAboutCard({
  organization,
  members,
  teams,
  isMembersPending = false,
  isTeamsPending = false,
}: OrganizationAboutCardProps) {
  const { t } = useTranslation();
  const locale = useLocale();

  const website = organization.website;
  const since = new Date(organization.createdAt).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
  const isMember = organization.role != null;

  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold tracking-tight">{t("organizations.about.title")}</h2>

      {/*
        Rendered as rich text, matching the listing card — this is a roomy paragraph, so
        real formatting belongs here. Untruncated, so the component's habit of ignoring
        `maxLines` on plain-text content cannot bite.

        The guard stays and the empty case never reaches the renderer: handed empty
        content it substitutes its own hardcoded English string, which would appear
        untranslated on the German and Dutch locales.
      */}
      {organization.description ? (
        <div className="text-muted-foreground mt-2 text-sm leading-relaxed">
          <RichTextRenderer content={organization.description} />
        </div>
      ) : (
        <p className="text-muted-foreground mt-2 text-sm">
          {t("organizations.about.noDescription")}
        </p>
      )}

      {/* Stacked label over value at `DetailsSidebarCard`'s scale — stacked rather than
          a fixed label column, so nothing competes for width here. */}
      <dl className="border-border mt-4 space-y-3 border-t pt-4">
        {organization.type ? (
          <Row label={t("organizations.fields.type")}>
            {t(organizationTypeLabelKey(organization.type))}
          </Row>
        ) : null}
        {organization.location ? (
          <Row label={t("organizations.fields.location")}>{organization.location}</Row>
        ) : null}
        {website ? (
          <Row label={t("organizations.fields.website")}>
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary inline-flex max-w-full items-center gap-1 hover:underline"
            >
              {/* The host alone: a full URL wraps out of a narrow column. */}
              <span className="truncate">{websiteHost(website)}</span>
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
            </a>
          </Row>
        ) : null}
        <Row label={t("organizations.about.onOpenJii")}>
          {t("organizations.about.since", { date: since })}
        </Row>

        {isMember ? (
          <>
            <Row label={t("organizations.tabs.members")}>
              <OrganizationAvatarTrail
                faces={(members ?? []).map((member) => ({
                  id: member.userId,
                  firstName: member.firstName,
                  lastName: member.lastName,
                  avatarUrl: member.avatarUrl,
                }))}
                // The profile's own count, so the caption does not wait on the roster.
                label={t("organizations.memberCount", { count: organization.memberCount })}
                href={organizationMembersPath(locale, organization.id)}
                isPending={isMembersPending}
              />
            </Row>
            <Row label={t("organizations.tabs.teams")}>
              <OrganizationAvatarTrail
                faces={(teams ?? []).map(teamAsTrailFace)}
                label={t("organizations.about.teamCount", { count: teams?.length ?? 0 })}
                href={organizationTeamsPath(locale, organization.id)}
                isPending={isTeamsPending}
              />
            </Row>
          </>
        ) : null}
      </dl>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-sm font-medium">{label}</dt>
      <dd className="text-muted-foreground min-w-0 text-sm">{children}</dd>
    </div>
  );
}

/**
 * The stored value's host, or the value verbatim when it does not parse as a URL —
 * the field takes the platform's standard URL rule and nothing else, so a value that
 * got past it is shown as it is rather than hidden.
 */
function websiteHost(website: string): string {
  try {
    return new URL(website).host || website;
  } catch {
    return website;
  }
}
