"use client";

import { Palette } from "lucide-react";
import { useMemo } from "react";

import { filterColumnsForRole } from "@repo/api/domains/experiment/visualizations/experiment-visualization-role-rules";
import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

import { ColorDimensionShelf } from "../../../../workspace/shelves/color/color-dimension-shelf";
import { SingleColumnShelf } from "../../../../workspace/shelves/single-column-shelf";
import { firstDataSourceByRole } from "../../../data/data-sources";
import type { ChartPanelProps, ShelfDef } from "../../../types";

function makeAxisGlyph(letter: string) {
  return function AxisGlyph({ className }: { className?: string }) {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-flex items-center justify-center font-mono text-[11px] font-semibold leading-none md:hidden",
          className,
        )}
      >
        {letter}
      </span>
    );
  };
}

const AAxisGlyph = makeAxisGlyph("A");
const BAxisGlyph = makeAxisGlyph("B");
const CAxisGlyph = makeAxisGlyph("C");

function TernaryAShelf({ form, columns }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const aColumns = useMemo(() => filterColumnsForRole(columns, "ternary", "x"), [columns]);
  return (
    <SingleColumnShelf
      form={form}
      columns={aColumns}
      role="x"
      heading={t("workspace.shelves.ternaryA")}
      columnLabel={t("workspace.shelves.column")}
      placeholder={t("workspace.shelves.selectColumn")}
    />
  );
}

function TernaryBShelf({ form, columns }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const bColumns = useMemo(() => filterColumnsForRole(columns, "ternary", "y"), [columns]);
  return (
    <SingleColumnShelf
      form={form}
      columns={bColumns}
      role="y"
      heading={t("workspace.shelves.ternaryB")}
      columnLabel={t("workspace.shelves.column")}
      placeholder={t("workspace.shelves.selectColumn")}
    />
  );
}

function TernaryCShelf({ form, columns }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const cColumns = useMemo(() => filterColumnsForRole(columns, "ternary", "z"), [columns]);
  return (
    <SingleColumnShelf
      form={form}
      columns={cColumns}
      role="z"
      heading={t("workspace.shelves.ternaryC")}
      columnLabel={t("workspace.shelves.column")}
      placeholder={t("workspace.shelves.selectColumn")}
    />
  );
}

function TernaryColorShelf({ form, columns, flat }: ChartPanelProps) {
  const colorColumns = useMemo(() => filterColumnsForRole(columns, "ternary", "color"), [columns]);
  return <ColorDimensionShelf form={form} columns={colorColumns} flat={flat} />;
}

export const ternaryDataShelves: ShelfDef[] = [
  {
    key: "a",
    labelKey: "workspace.shelves.ternaryA",
    icon: AAxisGlyph,
    Component: TernaryAShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "x")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
  {
    key: "b",
    labelKey: "workspace.shelves.ternaryB",
    icon: BAxisGlyph,
    Component: TernaryBShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "y")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
  {
    key: "c",
    labelKey: "workspace.shelves.ternaryC",
    icon: CAxisGlyph,
    Component: TernaryCShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "z")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
  {
    key: "color",
    labelKey: "workspace.shelves.groupBy",
    icon: Palette,
    Component: TernaryColorShelf,
    summary: (form) => {
      const sources = form.getValues("dataConfig.dataSources");
      const col = firstDataSourceByRole(sources, "color")?.source.columnName;
      return col && col.length > 0 ? col : undefined;
    },
  },
];
