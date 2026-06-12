import type { DataSourceConfig } from "@repo/api/schemas/experiment.schema";
import type { AlluvialSeriesData } from "@repo/ui/components/charts/parallel-coordinates";

import type { ChartFormConfig } from "../../chart-config";
import { getCategoryColor, getDefaultSeriesColor, withAlpha } from "../../colors/palettes";
import { toBucketKey } from "../../data/cell-coercion";
import { dataSourcesByRole } from "../../data/data-sources";

const MISSING_LABEL = "(missing)";
const FALLBACK_NODE_COLOR = "#888";

function toStageLabel(value: unknown): string {
  const key = toBucketKey(value);
  return key.length === 0 ? MISSING_LABEL : key;
}

interface AggregatedLink {
  sourceIdx: number;
  targetIdx: number;
  value: number;
}

export function transformAlluvialData(
  rows: Record<string, unknown>[],
  dataSources: DataSourceConfig[],
  chartConfig: ChartFormConfig,
): AlluvialSeriesData[] {
  const stages = dataSourcesByRole(dataSources, "groupBy")
    .map((entry) => entry.source.columnName)
    .filter((name) => name.length > 0);
  const valueColumn = dataSourcesByRole(dataSources, "value")[0]?.source.columnName;

  const hasEnoughStages = stages.length >= 2;
  if (!hasEnoughStages || rows.length === 0) {
    return [];
  }

  const nodeThickness = chartConfig.alluvialNodeThickness ?? 20;
  const nodePadding = chartConfig.alluvialNodePadding ?? 15;
  const linkOpacity = chartConfig.alluvialLinkOpacity ?? 0.4;
  const colorMode = chartConfig.alluvialColorMode ?? "stage";
  const hideLabels = Boolean(chartConfig.alluvialHideLabels);

  // Materialize each row's stage values once; reused for both node discovery and link aggregation.
  const stageValuesPerRow: string[][] = stages.map((column) =>
    rows.map((row) => toStageLabel(row[column])),
  );

  // Per-stage Map<label, nodeIdx>. Appending in first-seen order keeps the
  // visual order tied to data order, not alphabetical.
  const nodeIndexByStage: Map<string, number>[] = stages.map(() => new Map<string, number>());
  const nodeLabels: string[] = [];
  const nodeStageIndex: number[] = [];
  for (let stageIdx = 0; stageIdx < stages.length; stageIdx++) {
    const indexAtStage = nodeIndexByStage[stageIdx];
    for (const value of stageValuesPerRow[stageIdx]) {
      if (indexAtStage.has(value)) {
        continue;
      }
      indexAtStage.set(value, nodeLabels.length);
      nodeLabels.push(value);
      nodeStageIndex.push(stageIdx);
    }
  }

  const aggregatedLinks = aggregateLinks(stageValuesPerRow, rows, valueColumn, nodeIndexByStage);
  if (aggregatedLinks.length === 0) {
    return [];
  }

  const nodeColors = computeNodeColors({
    colorMode,
    nodeStageIndex,
    nodeLabels,
    colorMap: chartConfig.colorMap,
  });

  const linkColors = aggregatedLinks.map(({ sourceIdx }) =>
    withAlpha(nodeColors[sourceIdx] ?? FALLBACK_NODE_COLOR, linkOpacity),
  );

  return [
    {
      nodes: {
        label: hideLabels ? nodeLabels.map(() => "") : nodeLabels,
        color: nodeColors,
        pad: nodePadding,
        thickness: nodeThickness,
      },
      links: {
        source: aggregatedLinks.map((link) => link.sourceIdx),
        target: aggregatedLinks.map((link) => link.targetIdx),
        value: aggregatedLinks.map((link) => link.value),
        color: linkColors,
      },
      orientation: "h",
    },
  ];
}

// Aggregate links per consecutive stage pair. Non-numeric or non-positive
// value cells drop out: sankey can't render a negative or zero-width link.
function aggregateLinks(
  stageValuesPerRow: string[][],
  rows: Record<string, unknown>[],
  valueColumn: string | undefined,
  nodeIndexByStage: Map<string, number>[],
): AggregatedLink[] {
  const result: AggregatedLink[] = [];
  for (let i = 0; i < stageValuesPerRow.length - 1; i++) {
    const sumsByTarget = new Map<number, Map<number, number>>();
    for (let r = 0; r < rows.length; r++) {
      const sourceLabel = stageValuesPerRow[i][r];
      const targetLabel = stageValuesPerRow[i + 1][r];
      const sourceIdx = nodeIndexByStage[i].get(sourceLabel);
      const targetIdx = nodeIndexByStage[i + 1].get(targetLabel);
      if (sourceIdx === undefined || targetIdx === undefined) {
        continue;
      }
      const delta = valueColumn ? toPositiveNumber(rows[r][valueColumn]) : 1;
      if (delta === null) {
        continue;
      }
      const targets = sumsByTarget.get(sourceIdx) ?? new Map<number, number>();
      targets.set(targetIdx, (targets.get(targetIdx) ?? 0) + delta);
      sumsByTarget.set(sourceIdx, targets);
    }
    for (const [sourceIdx, targets] of sumsByTarget) {
      for (const [targetIdx, value] of targets) {
        result.push({ sourceIdx, targetIdx, value });
      }
    }
  }
  return result;
}

function toPositiveNumber(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

interface NodeColorParams {
  colorMode: "stage" | "value";
  nodeStageIndex: number[];
  nodeLabels: string[];
  colorMap: Record<string, string> | undefined;
}

// `stage` mode colours by stage column (reads as "structure across stages").
// `value` mode gives each unique label its own colour so a category
// appearing in multiple stages reads as the same colour.
function computeNodeColors({
  colorMode,
  nodeStageIndex,
  nodeLabels,
  colorMap,
}: NodeColorParams): string[] {
  if (colorMode === "stage") {
    return nodeStageIndex.map((stageIdx) => getDefaultSeriesColor(stageIdx));
  }
  const valueColors = new Map<string, string>();
  return nodeLabels.map((label) => {
    const existing = valueColors.get(label);
    if (existing) {
      return existing;
    }
    const color = getCategoryColor(valueColors.size, colorMap, label);
    valueColors.set(label, color);
    return color;
  });
}
