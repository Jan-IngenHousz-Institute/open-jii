import React from "react";

import { TableCell, TableRow } from "@repo/ui/components/table";

import { ArrayExpandedContent } from "./cells/array/data-table-array-cell";
import { MapExpandedContent } from "./cells/map/data-table-map-cell";
import { StructExpandedContent } from "./cells/struct/data-table-struct-cell";
import { VariantExpandedContent } from "./cells/variant/data-table-variant-cell";

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
  {
    match: (type: string) => type === "STRUCT" || type.startsWith("STRUCT<"),
    render: (data: string) => <StructExpandedContent data={data} />,
  },
];

export interface ExperimentDataTableCellCollapsibleProps {
  columnCount: number;
  columnName: string;
  columnType: string;
  cellData: unknown;
}

export function DataTableCellCollapsible({
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
    <TableRow className="bg-muted min-w-full">
      <TableCell colSpan={columnCount + 1} className="border-border border-t p-0">
        <div className="sticky left-0 w-[100cqw]">{content}</div>
      </TableCell>
    </TableRow>
  );
}
