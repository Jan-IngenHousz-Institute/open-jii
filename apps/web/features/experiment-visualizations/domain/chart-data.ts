import type { DataAggregation, DataFilter } from "@repo/api/schemas/experiment.schema";
import { WellKnownColumnTypes } from "@repo/api/schemas/experiment.schema";

export interface VisualizationDataConfig {
  tableName: string;
  columns?: string[];
  filters?: DataFilter[];
  aggregation?: DataAggregation;
  extraGroupByColumns?: string[];
  orderBy?: string;
  orderDirection?: "ASC" | "DESC";
}

export interface VisualizationDataRequest {
  columnsCsv: string | undefined;
  filtersJson: string | undefined;
  aggregationJson: string | undefined;
  orderBy: string | undefined;
  orderDirection: "ASC" | "DESC" | undefined;
  canQuery: boolean;
  /** Effective aggregation (extra groupBys merged in); undefined when aggregation is inactive. */
  aggregation: DataAggregation | undefined;
}

function hasAggregationContent(agg: DataAggregation | undefined): boolean {
  if (!agg) {
    return false;
  }
  return (agg.groupBy?.length ?? 0) > 0 || (agg.functions?.length ?? 0) > 0;
}

// Drop draft rows the inspector keeps around mid-edit; the API rejects them.
function compactFilters(filters: DataFilter[] | undefined): DataFilter[] | undefined {
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

function compactAggregation(agg: DataAggregation | undefined): DataAggregation | undefined {
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
function buildAliasMap(aggregation: DataAggregation): Record<string, string> {
  const map: Record<string, string> = {};
  for (const item of aggregation.groupBy ?? []) {
    const alias = item.timeBucket ? `${item.column}_${item.timeBucket}` : item.column;
    map[alias] = item.column;
  }
  return map;
}

// Window functions skip GROUP BY; keep this in sync with the SQL builder.
const WINDOW_FUNCTIONS: ReadonlySet<string> = new Set(["cumsum"]);

function isWindowOnlyAggregation(aggregation: DataAggregation): boolean {
  if ((aggregation.groupBy?.length ?? 0) > 0) {
    return false;
  }
  const fns = aggregation.functions ?? [];
  if (fns.length === 0) {
    return false;
  }
  return fns.every((f) => WINDOW_FUNCTIONS.has(f.function));
}

// Resolves a user-facing orderBy column to its post-aggregation alias.
// Returns undefined to drop the order when the column isn't projected.
function resolveOrderByForAggregation(
  orderBy: string | undefined,
  aggregation: DataAggregation,
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

// Derives the wire-format query params from a visualization data config.
export function buildVisualizationDataRequest(
  dataConfig: VisualizationDataConfig,
): VisualizationDataRequest {
  const cleanedColumns = dataConfig.columns?.filter((name) => name.length > 0);
  const cleanedFilters = compactFilters(dataConfig.filters);
  const baseAggregation = compactAggregation(dataConfig.aggregation);
  const baseAggregationActive = hasAggregationContent(baseAggregation);
  const extras = (dataConfig.extraGroupByColumns ?? []).filter((c) => c && c.length > 0);
  const aggregation =
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
      : baseAggregation;
  const aggregationActive = baseAggregationActive;

  const canQuery = aggregationActive || (cleanedColumns?.length ?? 0) > 0;

  const filtersJson =
    cleanedFilters && cleanedFilters.length > 0 ? JSON.stringify(cleanedFilters) : undefined;
  const aggregationJson =
    aggregationActive && aggregation ? JSON.stringify(aggregation) : undefined;

  const columnsCsv = aggregationActive
    ? undefined
    : cleanedColumns && cleanedColumns.length > 0
      ? cleanedColumns.join(",")
      : undefined;

  const orderBy =
    aggregationActive && aggregation
      ? resolveOrderByForAggregation(dataConfig.orderBy, aggregation)
      : dataConfig.orderBy;
  const orderDirection = orderBy ? dataConfig.orderDirection : undefined;

  return {
    columnsCsv,
    filtersJson,
    aggregationJson,
    orderBy,
    orderDirection,
    canQuery,
    aggregation: aggregationActive ? aggregation : undefined,
  };
}

// Flatten CONTRIBUTOR structs to their `name` so the chart layer sees plain strings.
// Null/unparseable becomes "Unknown" to keep the bucket visible (Plotly skips null-x points).
const UNKNOWN_CONTRIBUTOR = "Unknown";

interface VisualizationTable {
  columns: { name: string; type_text: string }[];
  rows: Record<string, unknown>[];
}

function flattenContributorCells<T extends VisualizationTable>(table: T): T {
  const contributorColumns = table.columns.filter(
    (c) => c.type_text === WellKnownColumnTypes.CONTRIBUTOR,
  );
  if (contributorColumns.length === 0) {
    return table;
  }
  const rows = table.rows.map((row) => {
    const out: Record<string, unknown> = { ...row };
    for (const col of contributorColumns) {
      const v = row[col.name];
      if (typeof v !== "string") {
        out[col.name] = UNKNOWN_CONTRIBUTOR;
        continue;
      }
      const parsed = JSON.parse(v) as { name?: string };
      const name = parsed.name?.trim();
      out[col.name] = name && name.length > 0 ? name : UNKNOWN_CONTRIBUTOR;
    }
    return out;
  });
  return { ...table, rows };
}

function remapAggregationAliases<T extends VisualizationTable>(
  table: T,
  aggregation: DataAggregation,
): T {
  const aliasMap = buildAliasMap(aggregation);
  const rows = table.rows.map((row) => {
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
  const columns = table.columns.map((col) => ({
    ...col,
    name: aliasMap[col.name] ?? col.name,
  }));
  return { ...table, columns, rows };
}

// DTO rows → chart-ready rows: groupBy aliases collapse back to source
// columns, CONTRIBUTOR structs flatten to display names.
export function remapVisualizationTable<T extends VisualizationTable>(
  table: T,
  aggregation: DataAggregation | undefined,
): T {
  const afterAlias = aggregation ? remapAggregationAliases(table, aggregation) : table;
  return flattenContributorCells(afterAlias);
}
