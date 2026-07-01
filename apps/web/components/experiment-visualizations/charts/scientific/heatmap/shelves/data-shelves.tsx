"use client";

import { useMemo } from "react";
import { useWatch } from "react-hook-form";

import { filterColumnsForRole } from "@repo/api/domains/experiment/visualizations/experiment-visualization-role-rules";
import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

import { XAxisShelf } from "../../../../workspace/shelves/x-axis-shelf";
import { YAxisShelf } from "../../../../workspace/shelves/y-axis-shelf";
import { ZShelf } from "../../../../workspace/shelves/z-shelf";
import { firstDataSourceByRole } from "../../../data/data-sources";
import { XAxisGlyph, YAxisGlyph } from "../../../shelf-axis-glyphs";
import type { ChartPanelProps, ShelfDef } from "../../../types";

function ZAxisGlyph({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex items-center justify-center font-mono text-[11px] font-semibold leading-none md:hidden",
        className,
      )}
    >
      Z
    </span>
  );
}

function HeatmapXShelf({ form, columns }: ChartPanelProps) {
  const xColumns = useMemo(() => filterColumnsForRole(columns, "heatmap", "x"), [columns]);
  return <XAxisShelf form={form} columns={xColumns} hideAxisType />;
}

function HeatmapYShelf({ form, columns }: ChartPanelProps) {
  const yColumns = useMemo(() => filterColumnsForRole(columns, "heatmap", "y"), [columns]);
  return (
    <YAxisShelf
      form={form}
      columns={yColumns}
      hideAxisType
      hideAggregate
      showSeriesColor={false}
      maxSeries={1}
    />
  );
}

function HeatmapZShelf({ form, columns }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const zColumns = useMemo(() => filterColumnsForRole(columns, "heatmap", "z"), [columns]);
  // ZShelf needs both axis columns to maintain the `groupBy` set when the
  // user toggles the aggregate.
  const sources = useWatch({ control: form.control, name: "dataConfig.dataSources" });
  const xColumn = firstDataSourceByRole(sources, "x")?.source.columnName ?? "";
  const yColumn = firstDataSourceByRole(sources, "y")?.source.columnName ?? "";
  return (
    <ZShelf
      form={form}
      columns={zColumns}
      heading={t("workspace.shelves.zAxis")}
      xColumn={xColumn}
      yColumn={yColumn}
    />
  );
}

export const heatmapDataShelves: ShelfDef[] = [
  {
    key: "x",
    labelKey: "workspace.shelves.xAxis",
    icon: XAxisGlyph,
    Component: HeatmapXShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "x")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
  {
    key: "y",
    labelKey: "workspace.shelves.yAxis",
    icon: YAxisGlyph,
    Component: HeatmapYShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "y")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
  {
    key: "z",
    labelKey: "workspace.shelves.zAxis",
    icon: ZAxisGlyph,
    Component: HeatmapZShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "z")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
];
