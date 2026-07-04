import { useMemo } from "react";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";
import { WellKnownColumnTypes } from "@repo/api/schemas/experiment.schema";

import { useExperimentDistinctValues } from "../../hooks/experiment/useExperimentDistinctValues/useExperimentDistinctValues";

export function useDistinctOptions(column: DataColumn, experimentId: string, tableName: string) {
  const { values, truncated, isLoading, isSuccess, error } = useExperimentDistinctValues({
    experimentId,
    tableName,
    column: column.name,
  });
  const isContributor = column.type_text === WellKnownColumnTypes.CONTRIBUTOR;
  const contributorMap = useContributorIdMap(values, isContributor);
  return { values, truncated, isLoading, isSuccess, error, isContributor, contributorMap };
}

export function useContributorIdMap(
  values: readonly (string | number)[],
  enabled = true,
): Map<string, string> | undefined {
  return useMemo(() => {
    if (!enabled) {
      return undefined;
    }
    return buildContributorIdMap(values);
  }, [values, enabled]);
}

function buildContributorIdMap(values: readonly (string | number)[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const raw of values) {
    const json = String(raw);
    const id = tryParseContributorId(json);
    if (id !== null) {
      map.set(id, json);
    }
  }
  return map;
}

function tryParseContributorId(json: string): string | null {
  try {
    const parsed = JSON.parse(json) as { id?: unknown };
    return typeof parsed.id === "string" ? parsed.id : null;
  } catch {
    return null;
  }
}

export function chipValueForOption(raw: string | number, isContributor: boolean): string | number {
  if (!isContributor) {
    return raw;
  }
  const id = tryParseContributorId(String(raw));
  return id ?? raw;
}
