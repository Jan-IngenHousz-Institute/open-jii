"use client";

import { ContributorIdentity } from "@/shared/ui/contributor/contributor-identity";
import { useExperimentDistinctValues } from "@/shared/ui/data-filters/useExperimentDistinctValues/useExperimentDistinctValues";

import type { DataFilter } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";

import { useContributorIdMap } from "../use-distinct-options";

const NO_VALUE = "-";

export interface ContributorChipValueProps {
  filterValue: DataFilter["value"];
  parentColumn: string;
  experimentId: string | undefined;
  tableName: string | undefined;
  className: string;
}

export function ContributorChipValue({
  filterValue,
  parentColumn,
  experimentId,
  tableName,
  className,
}: ContributorChipValueProps) {
  const { t } = useTranslation("common");
  const enabled = Boolean(experimentId && tableName);
  const { values } = useExperimentDistinctValues({
    experimentId: experimentId ?? "",
    tableName: tableName ?? "",
    column: parentColumn,
    enabled,
  });
  const idToStruct = useContributorIdMap(values);

  const selectedIds = collectSelectedIds(filterValue);

  if (selectedIds.length === 0) {
    return <span className={className}>{NO_VALUE}</span>;
  }
  if (selectedIds.length > 1) {
    const label = t("dataFilters.selectedCount", { count: selectedIds.length });
    return <span className={className}>{label}</span>;
  }

  const [id] = selectedIds;
  const struct = idToStruct?.get(id);
  if (!struct) {
    return <span className={className}>{id}</span>;
  }
  return <ContributorIdentity data={struct} size="compact" className={className} />;
}

function collectSelectedIds(filterValue: DataFilter["value"]): string[] {
  if (Array.isArray(filterValue)) {
    return filterValue.map((v) => String(v));
  }
  if (filterValue === "") {
    return [];
  }
  return [String(filterValue)];
}
