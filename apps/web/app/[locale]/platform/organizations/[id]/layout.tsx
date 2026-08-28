"use client";

import { PlatformHeaderDetail } from "@/components/navigation/site-header/platform-header-context";
import { OrganizationDetailTabs } from "@/components/organizations/organization-detail-tabs";
import { EntityLayoutShell } from "@/components/shared/entity-layout-shell";
import { useOrganization } from "@/hooks/organization/useOrganization/useOrganization";
import { useLocale } from "@/hooks/useLocale";
import { useParams } from "next/navigation";

import { useTranslation } from "@repo/i18n";

/**
 * Every organization route shares the identity card and the tab strip, and every
 * one of them needs the profile — which also settles the caller's role, so the
 * routes below can gate on it without each asking again.
 *
 * A private organization answers 404 for a non-member, which the shell turns into
 * a not-found page rather than an error: from outside, it does not exist.
 */
export default function OrganizationLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const locale = useLocale();
  const { t } = useTranslation("common");
  const { data, isPending, error } = useOrganization(id);

  return (
    <EntityLayoutShell
      isLoading={isPending}
      error={error}
      hasData={!!data}
      loadingMessage={t("common.loading")}
    >
      {data && (
        <>
          <PlatformHeaderDetail
            href={`/${locale}/platform/organizations/${id}`}
            label={data.name}
          />
          <OrganizationDetailTabs organization={data}>{children}</OrganizationDetailTabs>
        </>
      )}
    </EntityLayoutShell>
  );
}
