"use client";

import { Code, Eye } from "lucide-react";
import { getMacroColumns } from "~/components/overview-table/macro-columns";
import { ResourceList } from "~/components/resource-list/resource-list";
import { resourceListFilter } from "~/components/resource-list/resource-list-filter";
import { useMacros } from "~/hooks/macro/useMacros/useMacros";
import { useLocale } from "~/hooks/useLocale";
import { getMacroLanguageLabel } from "~/util/macro-language";

import { useTranslation } from "@repo/i18n";

export function ListMacros() {
  const list = useMacros();
  const { t } = useTranslation(["macro", "common"]);
  const locale = useLocale();

  return (
    <ResourceList
      list={list}
      filters={[
        resourceListFilter(list, "language", {
          label: t("macros.columns.language"),
          icon: Code,
          optionLabel: getMacroLanguageLabel,
        }),
        resourceListFilter(list, "visibility", {
          label: t("macros.visibility"),
          icon: Eye,
          optionLabel: (value) => t(`macros.${value}`),
        }),
      ]}
      searchInput={{
        placeholder: t("macros.searchPlaceholder"),
        clearLabel: t("macros.clearSearch"),
        loadingLabel: t("macros.loadingMacros"),
        className: "w-full md:w-[220px]",
      }}
      columns={getMacroColumns(t, locale)}
      getRowKey={(macro) => macro.id}
      getRowHref={(macro) => `/${locale}/platform/macros/${macro.id}`}
      errorMessage={t("macros.errorLoading")}
      emptyMessages={{
        filtered: t("macros.noFilterMatches"),
        searched: t("macros.noMatches"),
        empty: t("macros.noMacros"),
      }}
    />
  );
}
