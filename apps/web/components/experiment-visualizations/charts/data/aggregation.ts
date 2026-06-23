import type { UseFormReturn } from "react-hook-form";

import type {
  AggregationFunction,
  AggregationItem,
  DataAggregation,
  GroupByItem,
  TimeBucketUnit,
} from "@repo/api/schemas/experiment.schema";

import type { ChartFormDataConfig, ChartFormValues } from "../chart-config";

// Per-source `aggregate` fields are the form's source of truth; the wire-format
// `aggregation.functions[]` is rebuilt from them at save time.

export function getColumnBucket(
  aggregation: DataAggregation | undefined,
  column: string,
): TimeBucketUnit | undefined {
  if (!column) return undefined;
  return aggregation?.groupBy?.find((g) => g.column === column)?.timeBucket;
}

export function getDataSourceAggregate(
  sources: ChartFormDataConfig["dataSources"],
  dsIndex: number,
): AggregationFunction | undefined {
  return sources[dsIndex]?.aggregate;
}

/** Row aggregates require GROUP BY; the `cumsum` window function does not. */
export function aggregateRequiresGroupBy(fn: AggregationFunction): boolean {
  return fn !== "cumsum";
}

/** Stable SQL alias for a series's aggregate, unique even when two series share column + function. */
export function aggregateAliasForSource(
  columnName: string,
  fn: AggregationFunction,
  dsIndex: number,
): string {
  const base = columnName === "" || columnName === "*" ? "count" : columnName;
  return `${base}_${fn}_s${dsIndex}`;
}

/** Row key a renderer reads a data source's value under; matches the SQL projection scheme. */
export function rowKeyForSource(
  source: { columnName?: string; aggregate?: AggregationFunction | undefined },
  dsIndex: number,
): string {
  if (source.aggregate) {
    return aggregateAliasForSource(source.columnName ?? "", source.aggregate, dsIndex);
  }
  return source.columnName ?? "";
}

/** Row key for the legacy single-function aggregation path (pie's values shelf etc.). */
export function rowKeyForFunction(fn: {
  column: string;
  function: AggregationFunction;
  alias?: string;
}): string {
  if (fn.alias) return fn.alias;
  const base = fn.column === "*" ? "count" : fn.column;
  return `${base}_${fn.function}`;
}

// Materialise wire-format `functions[]` from per-source aggregates. Drops draft
// sources, schema-rejected `*` combos, and Y/size aggregates whose column is
// already in groupBy (would emit `AVG(<categorical-axis-col>)` and CAST-error).
function materializeFunctions(
  dataSources: ChartFormDataConfig["dataSources"],
  groupByColumns: ReadonlySet<string> = new Set(),
): AggregationItem[] {
  return dataSources
    .map((ds, dsIndex): AggregationItem | null => {
      if (!ds.aggregate) return null;
      const rawColumn = ds.columnName;
      const column = rawColumn === "" ? "*" : rawColumn;
      if (column === "*" && ds.aggregate !== "count" && ds.aggregate !== "cumsum") return null;
      if (
        (ds.role === "y" || ds.role === "size") &&
        rawColumn.length > 0 &&
        groupByColumns.has(rawColumn)
      ) {
        return null;
      }
      return {
        column,
        function: ds.aggregate,
        alias: aggregateAliasForSource(rawColumn, ds.aggregate, dsIndex),
      };
    })
    .filter((x): x is AggregationItem => x !== null);
}

/** Strip draft / incomplete entries from the form snapshot before sending it to the API. */
export function sanitizeDataConfigForSave(dataConfig: ChartFormDataConfig): ChartFormDataConfig {
  const cleanedFilters = dataConfig.filters?.filter((f) => {
    if (!f.column || f.column.length === 0) return false;
    if (Array.isArray(f.value)) return f.value.length > 0;
    if (typeof f.value === "string") return f.value.length > 0;
    return true;
  });

  // Cartesian charts derive functions[] from per-source aggregates; pie and
  // other single-function shelves write directly to aggregation.functions
  // and need that path preserved when no per-source aggregates exist.
  const groupBy = (dataConfig.aggregation?.groupBy ?? []).filter(
    (g) => g.column && g.column.length > 0,
  );
  const groupByColumnSet = new Set(groupBy.map((g) => g.column));
  const sourceFunctions = materializeFunctions(dataConfig.dataSources, groupByColumnSet);
  const existingFunctions = (dataConfig.aggregation?.functions ?? []).filter(
    (f) => f.column && f.column.length > 0 && Boolean(f.function),
  );
  const functions = sourceFunctions.length > 0 ? sourceFunctions : existingFunctions;

  let cleanedAggregation: DataAggregation | undefined;
  if (groupBy.length > 0 || functions.length > 0) {
    cleanedAggregation = {
      groupBy: groupBy.length > 0 ? groupBy : undefined,
      functions: functions.length > 0 ? functions : undefined,
    };
  }

  return {
    ...dataConfig,
    filters: cleanedFilters && cleanedFilters.length > 0 ? cleanedFilters : undefined,
    aggregation: cleanedAggregation,
  };
}

// Collapses the whole object to `undefined` when both arrays are empty; the
// schema rejects `{}`.
function writeAggregation(
  form: UseFormReturn<ChartFormValues>,
  groupBy: GroupByItem[],
  functions: AggregationItem[],
): void {
  const groupByOut = groupBy.length > 0 ? groupBy : undefined;
  const functionsOut = functions.length > 0 ? functions : undefined;
  form.setValue(
    "dataConfig.aggregation",
    groupByOut === undefined && functionsOut === undefined
      ? undefined
      : { groupBy: groupByOut, functions: functionsOut },
    { shouldDirty: true },
  );
}

/** Set (or clear) the time bucket for a column; `keepInGroupBy` keeps it as a group key. */
export function setColumnBucket(
  form: UseFormReturn<ChartFormValues>,
  column: string,
  bucket: TimeBucketUnit | undefined,
  keepInGroupBy: boolean,
): void {
  if (!column) return;
  const aggregation = form.getValues("dataConfig.aggregation");
  const groupBy = [...(aggregation?.groupBy ?? [])];
  const functions = [...(aggregation?.functions ?? [])];
  const idx = groupBy.findIndex((g) => g.column === column);

  if (bucket !== undefined) {
    const entry = { column, timeBucket: bucket };
    if (idx >= 0) groupBy[idx] = entry;
    else groupBy.push(entry);
  } else if (keepInGroupBy) {
    const entry = { column };
    if (idx >= 0) groupBy[idx] = entry;
    else groupBy.push(entry);
  } else if (idx >= 0) {
    groupBy.splice(idx, 1);
  }

  writeAggregation(form, groupBy, functions);
}

/**
 * Set (or clear) the aggregate function for a specific data source, keeping
 * the axis-column groupBy bookkeeping in sync. `axisColumns` is the set of
 * columns that should sit in groupBy whenever a row aggregate is active.
 */
export function setDataSourceAggregate(
  form: UseFormReturn<ChartFormValues>,
  dsIndex: number,
  fn: AggregationFunction | undefined,
  axisColumns: string | readonly string[],
): void {
  const axisColumnList = (typeof axisColumns === "string" ? [axisColumns] : axisColumns).filter(
    (c) => c && c.length > 0,
  );
  // cumsum (a window function) needs an axis column to define its running-total
  // ordering. Without one the SQL builder throws; refuse the change here so the
  // form never reaches that state, even if a caller bypasses the dropdown's UI guard.
  if (fn === "cumsum" && axisColumnList.length === 0) {
    return;
  }
  // Snapshot the pre-change state so we can detect "this is the first row
  // aggregate activating across the chart"; that's when sibling Y/size sources
  // without an aggregate need a default AVG, otherwise GROUP BY would drop
  // them and they'd render as nulls. Window aggregates (cumsum) don't impose
  // GROUP BY so they skip this default.
  const previousSources = form.getValues("dataConfig.dataSources");
  const previousAggregation = form.getValues("dataConfig.aggregation");
  const anyAxisWasBucketed = axisColumnList.some((col) =>
    Boolean(previousAggregation?.groupBy?.find((g) => g.column === col)?.timeBucket),
  );
  const wasAnyRowAggregateActive =
    anyAxisWasBucketed ||
    previousSources.some((ds) => ds.aggregate && aggregateRequiresGroupBy(ds.aggregate));

  form.setValue(`dataConfig.dataSources.${dsIndex}.aggregate` as const, fn, {
    shouldDirty: true,
  });

  // Activation: the first row aggregate going on. Default sibling Y/size
  // sources to AVG so they survive GROUP BY. Skip sources whose `columnName`
  // is itself one of the `axisColumns`; those columns sit in `groupBy` as
  // positional axes (heatmap / contour) so they already survive GROUP BY
  // without their own aggregate, and `AVG(<axis>)` on a STRING column
  // produces a CAST error from Databricks.
  const axisColumnSet = new Set(axisColumnList);
  const isActivatingRowAggregate =
    !wasAnyRowAggregateActive && fn !== undefined && aggregateRequiresGroupBy(fn);
  if (isActivatingRowAggregate) {
    previousSources.forEach((ds, i) => {
      if (i === dsIndex) return;
      if (ds.aggregate) return;
      if (ds.role !== "y" && ds.role !== "size") return;
      if (!ds.columnName) return;
      if (axisColumnSet.has(ds.columnName)) return;
      form.setValue(`dataConfig.dataSources.${i}.aggregate` as const, "avg", {
        shouldDirty: true,
      });
    });
  }

  // Compute the post-update `groupBy` first; axis columns live there only when
  // at least one row aggregate is active. Window-only aggregations don't need
  // GROUP BY (the SQL builder emits `SELECT *, <window>` to keep raw rows).
  // We need this before materialising functions so the function-set can drop
  // stale `avg(<axis-col>)` entries against the right groupBy.
  const sources = form.getValues("dataConfig.dataSources");
  const aggregation = form.getValues("dataConfig.aggregation");
  const groupBy = [...(aggregation?.groupBy ?? [])];
  const anyRowAggregateActive = sources.some(
    (ds) => ds.aggregate && aggregateRequiresGroupBy(ds.aggregate),
  );

  for (const axisColumn of axisColumnList) {
    const idx = groupBy.findIndex((g) => g.column === axisColumn);
    const hasBucket = idx >= 0 && groupBy[idx].timeBucket !== undefined;
    if (anyRowAggregateActive && idx < 0) {
      groupBy.push({ column: axisColumn });
    } else if (!anyRowAggregateActive && idx >= 0 && !hasBucket) {
      groupBy.splice(idx, 1);
    }
  }

  // Rebuild the wire-format `functions[]` against the new groupBy so the live
  // preview's query hashes the updated aggregation and refetches.
  const groupByColumnSet = new Set(groupBy.map((g) => g.column));
  const functions = materializeFunctions(sources, groupByColumnSet);

  writeAggregation(form, groupBy, functions);
}
