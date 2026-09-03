"use client";

import { useMyOrganizations } from "@/hooks/organization/useMyOrganizations/useMyOrganizations";

import { useTranslation } from "@repo/i18n";

/**
 * How an owning organization reads to the person who chose it.
 *
 * A personal workspace is always "Personal", never its generated name — that name
 * is not one anybody picked, and the create pickers already label it this way, so a
 * review step showing "Ada's workspace" would look like a different answer than the
 * one just given.
 *
 * `null` while the memberships are still loading, so a caller can hold off rather
 * than briefly claim "Personal" for an organization it simply has not resolved yet.
 */
export function useOwningOrganizationLabel(
  organizationId: string | null | undefined,
): string | null {
  const { t } = useTranslation();
  const { data, isPending } = useMyOrganizations();

  // No id at all is the picker's default, which needs no lookup to name.
  if (!organizationId) return t("organizations.picker.personal");
  if (isPending) return null;

  const organization = (data ?? []).find((candidate) => candidate.id === organizationId);
  if (!organization) {
    // An id the caller does not belong to. The server refuses such a create, so
    // this is the honest reading rather than an invented name.
    return t("organizations.picker.personal");
  }

  return organization.isPersonal ? t("organizations.picker.personal") : organization.name;
}
