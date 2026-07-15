import { contributorDisplayName } from "@/components/experiment-visualizations/charts/data/contributor-cells";
import { deviceDisplayName } from "@/components/experiment-visualizations/charts/data/device-cells";
import { shouldRetryQuery } from "@/util/query-retry";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { orpc } from "~/lib/orpc";

import type {
  ExperimentDataAggregation,
  ExperimentDataFilter,
} from "@repo/api/domains/experiment/data/experiment-data.schema";
import { WellKnownColumnTypes } from "@repo/api/domains/experiment/data/experiment-data.schema";

const STALE_TIME = 2 * 60 * 1000;

export interface VisualizationDataConfig {
  tableName: string;
  columns?: string[];
  filters?: ExperimentDataFilter[];
  aggregation?: ExperimentDataAggregation;
  extraGroupByColumns?: string[];
  orderBy?: string;
  orderDirection?: "ASC" | "DESC";
}

function hasAggregationContent(agg: ExperimentDataAggregation | undefined): boolean {
  if (!agg) {
    return false;
  }
  return (agg.groupBy?.length ?? 0) > 0 || (agg.functions?.length ?? 0) > 0;
}

// Drop draft rows the inspector keeps around mid-edit; the API rejects them.
function compactFilters(
  filters: ExperimentDataFilter[] | undefined,
): ExperimentDataFilter[] | undefined {
  if (!filters || filters.length === 0) {
    return undefined;
  }
  const compact = filters.filter((f) => {
    if (!f.column || f.column.length === 0) {
      return false;
    }
    if (Array.isArray(f.value)) {
      return f.value.length > 0;
    }
    if (typeof f.value === "string") {
      return f.value.length > 0;
    }
    return true;
  });
  return compact.length > 0 ? compact : undefined;
}

function compactAggregation(
  agg: ExperimentDataAggregation | undefined,
): ExperimentDataAggregation | undefined {
  if (!agg) {
    return undefined;
  }
  const groupBy = (agg.groupBy ?? []).filter((g) => g.column && g.column.length > 0);
  const functions = (agg.functions ?? []).filter((f) => f.column && f.column.length > 0);
  if (groupBy.length === 0 && functions.length === 0) {
    return undefined;
  }
  return {
    groupBy: groupBy.length > 0 ? groupBy : undefined,
    functions: functions.length > 0 ? functions : undefined,
  };
}

// Maps groupBy aliases (`timestamp_hour`) back to source column.
// Function aliases stay verbatim, they're per-series keys the renderer reads directly.
function buildAliasMap(aggregation: ExperimentDataAggregation): Record<string, string> {
  const map: Record<string, string> = {};
  for (const item of aggregation.groupBy ?? []) {
    const alias = item.timeBucket ? `${item.column}_${item.timeBucket}` : item.column;
    map[alias] = item.column;
  }
  return map;
}

// Window functions skip GROUP BY; keep this in sync with the SQL builder.
const WINDOW_FUNCTIONS: ReadonlySet<string> = new Set(["cumsum"]);

function isWindowOnlyAggregation(aggregation: ExperimentDataAggregation): boolean {
  if ((aggregation.groupBy?.length ?? 0) > 0) {
    return false;
  }
  const fns = aggregation.functions ?? [];
  if (fns.length === 0) {
    return false;
  }
  return fns.every((f) => WINDOW_FUNCTIONS.has(f.function));
}

// Flatten CONTRIBUTOR/DEVICE structs to their display field so the chart layer sees plain strings.
function flattenStructCells<
  T extends {
    columns: { name: string; type_text: string }[];
    rows: Record<string, unknown>[];
  },
>(table: T): T {
  const structColumns = table.columns.filter(
    (c) =>
      c.type_text === WellKnownColumnTypes.CONTRIBUTOR ||
      c.type_text === WellKnownColumnTypes.DEVICE,
  );
  if (structColumns.length === 0) {
    return table;
  }
  const rows = table.rows.map((row) => {
    const out: Record<string, unknown> = { ...row };
    for (const col of structColumns) {
      out[col.name] =
        col.type_text === WellKnownColumnTypes.DEVICE
          ? deviceDisplayName(row[col.name])
          : contributorDisplayName(row[col.name]);
    }
    return out;
  });
  return { ...table, rows };
}

// Resolves a user-facing orderBy column to its post-aggregation alias.
// Returns undefined to drop the order when the column isn't projected.
function resolveOrderByForAggregation(
  orderBy: string | undefined,
  aggregation: ExperimentDataAggregation,
): string | undefined {
  if (!orderBy) {
    return undefined;
  }

  const grouped = aggregation.groupBy?.find((g) => g.column === orderBy);
  if (grouped) {
    return grouped.timeBucket ? `${orderBy}_${grouped.timeBucket}` : orderBy;
  }

  // Window-only wrap is `SELECT *, <window>`, so raw columns stay in scope.
  if (isWindowOnlyAggregation(aggregation)) {
    return orderBy;
  }

  return undefined;
}

export const useExperimentVisualizationData = (
  experimentId: string,
  dataConfig: VisualizationDataConfig,
  enabled = true,
) => {
  const cleanedColumns = dataConfig.columns?.filter((name) => name.length > 0);
  const cleanedFilters = compactFilters(dataConfig.filters);
  const baseAggregation = compactAggregation(dataConfig.aggregation);
  const baseAggregationActive = hasAggregationContent(baseAggregation);
  const extras = (dataConfig.extraGroupByColumns ?? []).filter((c) => c && c.length > 0);
  const aggregation = useMemo(
    () =>
      baseAggregationActive && extras.length > 0 && baseAggregation
        ? {
            ...baseAggregation,
            groupBy: [
              ...(baseAggregation.groupBy ?? []),
              ...extras
                .filter((col) => !(baseAggregation.groupBy ?? []).some((g) => g.column === col))
                .map((col) => ({ column: col })),
            ],
          }
        : baseAggregation,
    [baseAggregation, baseAggregationActive, extras],
  );
  const aggregationActive = baseAggregationActive;

  const canQuery = aggregationActive || (cleanedColumns?.length ?? 0) > 0;

  // Share JSON between cache key and request so identical sets hit the cache.
  const filtersJson = useMemo(
    () =>
      cleanedFilters && cleanedFilters.length > 0 ? JSON.stringify(cleanedFilters) : undefined,
    [cleanedFilters],
  );
  const aggregationJson = useMemo(
    () => (aggregationActive && aggregation ? JSON.stringify(aggregation) : undefined),
    [aggregation, aggregationActive],
  );

  const columnsCsv = aggregationActive
    ? undefined
    : cleanedColumns && cleanedColumns.length > 0
      ? cleanedColumns.join(",")
      : undefined;

  const effectiveOrderBy =
    aggregationActive && aggregation
      ? resolveOrderByForAggregation(dataConfig.orderBy, aggregation)
      : dataConfig.orderBy;
  const effectiveOrderDirection = effectiveOrderBy ? dataConfig.orderDirection : undefined;

  const { data, isLoading, error } = useQuery(
    orpc.experiments.getExperimentData.queryOptions({
      input: {
        id: experimentId,
        tableName: dataConfig.tableName,
        columns: columnsCsv,
        filters: filtersJson,
        aggregation: aggregationJson,
        orderBy: effectiveOrderBy,
        orderDirection: effectiveOrderDirection,
      },
      staleTime: STALE_TIME,
      enabled: enabled && Boolean(dataConfig.tableName) && canQuery,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: shouldRetryQuery,
    }),
  );

  const tableData = data?.[0];

  const remappedData = useMemo(() => {
    if (!tableData?.data) {
      return undefined;
    }
    const afterAlias = (() => {
      if (!aggregationActive || !aggregation) {
        return tableData.data;
      }
      const aliasMap = buildAliasMap(aggregation);
      const remappedRows = tableData.data.rows.map((row: Record<string, unknown>) => {
        const out: Record<string, unknown> = { ...row };
        for (const [alias, original] of Object.entries(aliasMap)) {
          if (alias === original) {
            continue;
          }
          if (alias in row) {
            out[original] = row[alias];
            delete out[alias];
          }
        }
        return out;
      });
      const remappedColumns = tableData.data.columns.map((col) => ({
        ...col,
        name: aliasMap[col.name] ?? col.name,
      }));
      return {
        ...tableData.data,
        columns: remappedColumns,
        rows: remappedRows,
      };
    })();
    return flattenStructCells(afterAlias);
  }, [tableData, aggregation, aggregationActive]);

  return {
    data: remappedData,
    tableInfo: tableData
      ? {
          name: tableData.name,
          catalog_name: tableData.catalog_name,
          schema_name: tableData.schema_name,
          totalRows: tableData.totalRows,
        }
      : undefined,
    isLoading,
    error,
  };
};
