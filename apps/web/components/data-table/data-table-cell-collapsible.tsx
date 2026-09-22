import { X } from "lucide-react";
import React from "react";

import { isNumericArrayType } from "@repo/api/transforms/column-type-utils";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { TableCell, TableRow } from "@repo/ui/components/table";

import { ArrayExpandedContent } from "./cells/array/data-table-array-cell";
import { ChartExpandedContent } from "./cells/chart/chart-expanded-content";
import { MapExpandedContent } from "./cells/map/data-table-map-cell";
import { StructExpandedContent } from "./cells/struct/data-table-struct-cell";
import { VariantExpandedContent } from "./cells/variant/data-table-variant-cell";

interface ExpandedContentRenderer {
  match: (type: string) => boolean;
  render: (data: string, columnName: string) => React.ReactNode;
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
  {
    // Must stay last: its bare "ARRAY" match is broader than the
    // ARRAY<STRUCT<...> entry above and would otherwise shadow it.
    match: (type: string) => isNumericArrayType(type),
    render: (data: string, columnName: string) => (
      <ChartExpandedContent data={data} columnName={columnName} />
    ),
  },
];

export interface ExperimentDataTableCellCollapsibleProps {
  columnCount: number;
  columnName: string;
  columnType: string;
  cellData: unknown;
  onClose?: () => void;
}

export function DataTableCellCollapsible({
  columnCount,
  columnName,
  columnType,
  cellData,
  onClose,
}: ExperimentDataTableCellCollapsibleProps) {
  const { t } = useTranslation("common");

  // Find the appropriate renderer for this type
  const renderer = EXPANDED_CONTENT_RENDERERS.find((r) => r.match(columnType));

  if (!renderer || typeof cellData !== "string") {
    return null;
  }

  const content = renderer.render(cellData, columnName);

  if (!content) {
    return null;
  }

  return (
    <TableRow className="bg-muted min-w-full">
      <TableCell colSpan={columnCount + 1} className="border-border border-t p-0">
        {/* `sticky left-0` keeps this pinned to the visible left edge of the
            table's horizontal scroll container, so the close control stays
            reachable no matter how far right the table is scrolled. */}
        <div className="sticky left-0 w-[100cqw]">
          <div className="border-border bg-muted flex items-center justify-between border-b px-3 py-1.5">
            <span className="text-foreground text-xs font-semibold">{columnName}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:bg-muted size-5"
              onClick={onClose}
              title={t("common.close")}
              aria-label={t("common.close")}
            >
              <X className="size-3" />
            </Button>
          </div>
          {content}
        </div>
      </TableCell>
    </TableRow>
  );
}
