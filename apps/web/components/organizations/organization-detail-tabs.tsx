"use client";

import { useLocale } from "@/hooks/useLocale";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { OrganizationProfile } from "@repo/api/domains/organization/organization.schema";
import { useTranslation } from "@repo/i18n";
import { NavTabs, NavTabsList, NavTabsTrigger } from "@repo/ui/components/nav-tabs";

import { OrganizationHeader } from "./organization-header";
import {
  organizationMembersPath,
  organizationPath,
  organizationSettingsPath,
  organizationTeamsPath,
} from "./organization-routes";

interface OrganizationDetailTabsProps {
  organization: OrganizationProfile;
  children: React.ReactNode;
}

/**
 * The organization's band — identity and tab strip as one block, separated from the
 * body by a single rule, so the strip reads as belonging to the organization above it
 * rather than to the page below.
 *
 * One route per tab. Overview exists for anyone who can see the organization at all;
 * members get the management routes; settings are owner-only, and the absence of the
 * tab is the first half of that — the routes refuse independently.
 *
 * An outsider on a public organization gets the identity band with no strip under it:
 * a lone tab is not a choice.
 */
export function OrganizationDetailTabs({ organization, children }: OrganizationDetailTabsProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const locale = useLocale();

  const isMember = organization.role !== null;
  const isOwner = organization.role === "owner";

  if (!isMember) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="border-border border-b pb-5">
          <OrganizationHeader organization={organization} />
        </div>
        <div className="mt-6 flex flex-1 flex-col">{children}</div>
      </div>
    );
  }

  const activeTab = pathname.includes("/members")
    ? "members"
    : pathname.includes("/teams")
      ? "teams"
      : pathname.includes("/settings")
        ? "settings"
        : "overview";

  return (
    <NavTabs value={activeTab} className="flex w-full flex-1 flex-col">
      {/* The strip's own bottom rule doubles as the band's, so the two do not stack. */}
      <div className="border-border flex flex-col gap-4 border-b pt-1">
        <OrganizationHeader organization={organization} />
        <NavTabsList className="border-b-0">
          <NavTabsTrigger value="overview" asChild>
            <Link href={organizationPath(locale, organization.id)}>{t("common.overview")}</Link>
          </NavTabsTrigger>
          <NavTabsTrigger value="members" asChild>
            <Link href={organizationMembersPath(locale, organization.id)}>
              {t("organizations.tabs.members")}
            </Link>
          </NavTabsTrigger>
          <NavTabsTrigger value="teams" asChild>
            <Link href={organizationTeamsPath(locale, organization.id)}>
              {t("organizations.tabs.teams")}
            </Link>
          </NavTabsTrigger>
          {isOwner && (
            <NavTabsTrigger value="settings" asChild>
              <Link href={organizationSettingsPath(locale, organization.id)}>
                {t("organizations.tabs.settings")}
              </Link>
            </NavTabsTrigger>
          )}
        </NavTabsList>
      </div>

      <div className="mt-6 flex flex-1 flex-col">{children}</div>
    </NavTabs>
  );
}
