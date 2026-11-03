"use client";

import { Cpu, Eye } from "lucide-react";
import { getProtocolColumns } from "~/components/overview-table/protocol-columns";
import { ResourceList } from "~/components/resource-list/resource-list";
import { resourceListFilter } from "~/components/resource-list/resource-list-filter";
import { useProtocols } from "~/hooks/protocol/useProtocols/useProtocols";
import { useLocale } from "~/hooks/useLocale";
import { getSensorFamilyLabel } from "~/util/sensor-family";

import { useTranslation } from "@repo/i18n";

export function ListProtocols() {
  const list = useProtocols();
  const { t } = useTranslation("common");
  const locale = useLocale();

  return (
    <ResourceList
      list={list}
      filters={[
        resourceListFilter(list, "family", {
          label: t("protocols.columns.family"),
          icon: Cpu,
          optionLabel: getSensorFamilyLabel,
        }),
        resourceListFilter(list, "visibility", {
          label: t("protocols.visibility"),
          icon: Eye,
          optionLabel: (value) => t(`protocols.${value}`),
        }),
      ]}
      searchInput={{
        placeholder: t("protocols.searchProtocols"),
        clearLabel: t("protocols.clearSearch"),
        loadingLabel: t("protocols.loadingProtocols"),
        className: "w-full md:w-[220px]",
      }}
      columns={getProtocolColumns(t, locale)}
      getRowKey={(protocol) => protocol.id}
      getRowHref={(protocol) => `/${locale}/platform/protocols/${protocol.id}`}
      errorMessage={t("errors.failedToLoadProtocol")}
      emptyMessages={{
        filtered: t("protocols.noFilterMatches"),
        searched: t("protocols.noMatches"),
        empty: t("protocols.noProtocols"),
      }}
    />
  );
}
