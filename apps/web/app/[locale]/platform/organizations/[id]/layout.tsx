"use client";

import { OrganizationDetailTabs } from "@/components/organizations/organization-detail-tabs";
import { OrganizationHeader } from "@/components/organizations/organization-header";
import { EntityLayoutShell } from "@/components/shared/entity-layout-shell";
import { useOrganization } from "@/hooks/organization/useOrganization/useOrganization";
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
  const { t } = useTranslation("common");
  const { data, isLoading, error } = useOrganization(id);

  return (
    <EntityLayoutShell
      isLoading={isLoading}
      error={error}
      hasData={!!data}
      loadingMessage={t("common.loading")}
    >
      {data && (
        <div className="flex flex-1 flex-col gap-6">
          <OrganizationHeader organization={data} />
          <OrganizationDetailTabs organization={data}>{children}</OrganizationDetailTabs>
        </div>
      )}
    </EntityLayoutShell>
  );
}
