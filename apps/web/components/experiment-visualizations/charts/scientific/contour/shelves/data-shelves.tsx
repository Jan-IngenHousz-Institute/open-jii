"use client";

import { useMemo } from "react";
import { useWatch } from "react-hook-form";

import { filterColumnsForRole } from "@repo/api/domains/experiment/experiment-visualization-contracts";
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

function ContourXShelf({ form, columns }: ChartPanelProps) {
  const xColumns = useMemo(() => filterColumnsForRole(columns, "contour", "x"), [columns]);
  return <XAxisShelf form={form} columns={xColumns} hideAxisType />;
}

function ContourYShelf({ form, columns }: ChartPanelProps) {
  const yColumns = useMemo(() => filterColumnsForRole(columns, "contour", "y"), [columns]);
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

function ContourZShelf({ form, columns }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const zColumns = useMemo(() => filterColumnsForRole(columns, "contour", "z"), [columns]);
  const sources = useWatch({ control: form.control, name: "dataConfig.dataSources" });
  const xColumn = firstDataSourceByRole(sources, "x")?.source.columnName ?? "";
  const yColumn = firstDataSourceByRole(sources, "y")?.source.columnName ?? "";
  return (
    <ZShelf
      form={form}
      columns={zColumns}
      heading={t("workspace.shelves.zAxisLevel")}
      xColumn={xColumn}
      yColumn={yColumn}
    />
  );
}

export const contourDataShelves: ShelfDef[] = [
  {
    key: "x",
    labelKey: "workspace.shelves.xAxis",
    icon: XAxisGlyph,
    Component: ContourXShelf,
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
    Component: ContourYShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "y")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
  {
    key: "z",
    labelKey: "workspace.shelves.zAxisLevel",
    icon: ZAxisGlyph,
    Component: ContourZShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "z")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
];
