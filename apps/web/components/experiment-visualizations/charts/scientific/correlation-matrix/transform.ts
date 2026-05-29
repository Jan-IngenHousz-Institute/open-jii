import type { DataSourceConfig } from "@repo/api/schemas/experiment.schema";

import { aliasForCorrelationPair } from "../../data/correlation-alias";
import { dataSourcesByRole } from "../../data/data-sources";

export interface CorrelationMatrixTransformResult {
  matrix: number[][] | null;
  labels: string[];
}

/** Assembles the symmetric correlation matrix from the aggregation row's per-pair aliases. */
export function transformCorrelationMatrixData(
  rows: Record<string, unknown>[],
  dataSources: DataSourceConfig[],
): CorrelationMatrixTransformResult {
  const pickedColumns = dataSourcesByRole(dataSources, "y")
    .map((entry) => entry.source.columnName)
    .filter((c): c is string => typeof c === "string" && c.length > 0);
  // Pairwise correlation needs >= 2 distinct columns; dedupe so two rows
  // pointing at the same column don't introduce a phantom pair.
  const labels = Array.from(new Set(pickedColumns));

  const hasEnoughColumns = labels.length >= 2;
  const hasRows = rows.length > 0;
  if (!hasEnoughColumns || !hasRows) {
    return { matrix: null, labels };
  }

  const row = rows[0];
  const matrix = labels.map((rowLabel) =>
    labels.map((colLabel) => readCorrelationCell(row, rowLabel, colLabel)),
  );
  return { matrix, labels };
}

function readCorrelationCell(
  row: Record<string, unknown>,
  rowLabel: string,
  colLabel: string,
): number {
  const isDiagonal = rowLabel === colLabel;
  if (isDiagonal) {
    return 1;
  }
  const v = row[aliasForCorrelationPair(rowLabel, colLabel)];
  if (typeof v === "number" && Number.isFinite(v)) {
    return v;
  }
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return NaN;
}
