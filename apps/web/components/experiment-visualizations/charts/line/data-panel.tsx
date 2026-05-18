"use client";

import { useMemo } from "react";

import { getColumnKind } from "@repo/api/utils/column-type-utils";
import { filterColumnsForRole } from "@repo/api/utils/visualization-contracts";
import { Separator } from "@repo/ui/components/separator";

import { FiltersShelf } from "../../workspace/shelves/filters-shelf";
import { XAxisShelf } from "../../workspace/shelves/x-axis-shelf";
import { YAxisShelf } from "../../workspace/shelves/y-axis-shelf";
import type { ChartPanelProps } from "../types";

export function LineDataPanel({ form, columns }: ChartPanelProps) {
  const xColumns = useMemo(() => filterColumnsForRole(columns, "line", "x"), [columns]);
  const yColumns = useMemo(() => filterColumnsForRole(columns, "line", "y"), [columns]);
  // Filters honour `equals` only for now, so categorical columns are what
  // pays off in practice (filter by school / plot / treatment).
  const filterableColumns = useMemo(
    () => columns.filter((c) => getColumnKind(c.type_text) === "categorical"),
    [columns],
  );

  return (
    <div className="space-y-6">
      <XAxisShelf form={form} columns={xColumns} />
      <Separator />
      <YAxisShelf form={form} columns={yColumns} />
      <Separator />
      <FiltersShelf form={form} filterableColumns={filterableColumns} />
    </div>
  );
}
