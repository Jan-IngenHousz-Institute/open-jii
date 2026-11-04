"use client";

import { getOrganizationColumns } from "@/components/overview-table/organization-columns";
import { ResourceList } from "@/components/resource-list/resource-list";
import { resourceListFilter } from "@/components/resource-list/resource-list-filter";
import { useOrganizationsList } from "@/hooks/organization/useOrganizationsList/useOrganizationsList";
import { useLocale } from "@/hooks/useLocale";
import { Building2 } from "lucide-react";

import { useTranslation } from "@repo/i18n";

import { organizationTypeLabelKey } from "./organization-labels";
import { organizationPath } from "./organization-routes";

/**
 * Organization directory table with URL-backed search, type filters, sorting,
 * and client-side pagination.
 */
export function ListOrganizations() {
  const list = useOrganizationsList();
  const { t } = useTranslation();
  const locale = useLocale();

  return (
    <ResourceList
      list={list}
      filters={[
        resourceListFilter(list, "type", {
          label: t("organizations.fields.type"),
          icon: Building2,
          optionLabel: (value) => t(organizationTypeLabelKey(value)),
        }),
      ]}
      searchInput={{
        placeholder: t("organizations.searchPlaceholder"),
        "aria-label": t("organizations.searchLabel"),
        clearLabel: t("common.clear"),
        loadingLabel: t("common.loading"),
      }}
      columns={getOrganizationColumns(t)}
      getRowKey={(organization) => organization.id}
      getRowHref={(organization) => organizationPath(locale, organization.id)}
      errorMessage={t("organizations.directory.loadFailed")}
      emptyMessages={{
        filtered: t("organizations.noFilterMatches"),
        searched: t("organizations.noMatches"),
        empty: t("organizations.directory.emptyTitle"),
      }}
    />
  );
}
