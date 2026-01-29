import React from "react";

import { TableCell, TableRow } from "@repo/ui/components";

import { ArrayExpandedContent } from "./experiment-data-table-array-cell";
import { MapExpandedContent } from "./experiment-data-table-map-cell";
import { VariantExpandedContent } from "./experiment-data-table-variant-cell";

interface ExpandedContentRenderer {
  match: (type: string) => boolean;
  render: (data: string) => React.ReactNode;
}

// Registry of expanded content renderers by type
const EXPANDED_CONTENT_RENDERERS: ExpandedContentRenderer[] = [
  {
    match: (type: string) => type === "VARIANT",
    render: (data: string) => <VariantExpandedContent data={data} />,
  },
  {
    match: (type: string) => type.startsWith("ARRAY<STRUCT<"),
    render: (data: string) => <ArrayExpandedContent data={data} />,
  },
  {
    match: (type: string) => type === "MAP" || type.startsWith("MAP<"),
    render: (data: string) => <MapExpandedContent data={data} />,
  },
];

export interface ExperimentDataTableCellCollapsibleProps {
  columnCount: number;
  columnName: string;
  columnType: string;
  cellData: unknown;
}

export function ExperimentDataTableCellCollapsible({
  columnCount,
  columnName: _columnName,
  columnType,
  cellData,
}: ExperimentDataTableCellCollapsibleProps) {
  // Find the appropriate renderer for this type
  const renderer = EXPANDED_CONTENT_RENDERERS.find((r) => r.match(columnType));

  if (!renderer || typeof cellData !== "string") {
    return null;
  }

  const content = renderer.render(cellData);

  if (!content) {
    return null;
  }

  return (
    <TableRow className="bg-gray-50 dark:bg-gray-800">
      <TableCell
        colSpan={columnCount}
        className="sticky left-0 border-t border-gray-200 p-0 dark:border-gray-700"
      >
        <div className="overflow-x-auto">{content}</div>
      </TableCell>
    </TableRow>
  );
}
