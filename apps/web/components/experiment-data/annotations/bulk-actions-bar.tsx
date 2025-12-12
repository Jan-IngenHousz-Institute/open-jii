import { MessageSquare, ChevronDown, Trash2, Download, Flag } from "lucide-react";
import React from "react";

import type { AnnotationType } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components";

import { parseAnnotations, groupAnnotations } from "../experiment-data-table-annotations-cell";

interface BulkActionsBarProps {
  rowIds: string[];
  tableRows?: { id?: unknown; annotations?: unknown }[];
  downloadTable: () => void;
  onAddAnnotation: (rowIds: string[], type: AnnotationType) => void;
  onDeleteAnnotations: (rowIds: string[], type: AnnotationType) => void;
}

export function BulkActionsBar({
  rowIds,
  tableRows,
  downloadTable,
  onAddAnnotation,
  onDeleteAnnotations,
}: BulkActionsBarProps) {
  const { t } = useTranslation();
  const selectedCount = rowIds.length;

  // Count total annotations by type in selected rows
  const { totalComments, totalFlags } = React.useMemo(() => {
    if (!tableRows) return { totalComments: 0, totalFlags: 0 };

    const selectedRows = tableRows.filter(
      (row) => row.annotations && rowIds.includes(String(row.id)),
    );

    let commentCount = 0;
    let flagCount = 0;

    selectedRows.forEach((row) => {
      const annotations = parseAnnotations(row.annotations as string);
      const grouped = groupAnnotations(annotations);
      commentCount += grouped.comment.length;
      flagCount += grouped.flag.length;
    });

    return { totalComments: commentCount, totalFlags: flagCount };
  }, [rowIds, tableRows]);

  return (
    <div className="bg-background flex items-center justify-between rounded-t-lg border border-b-0 px-4 py-3">
      <div className="flex items-center gap-4">
        {selectedCount > 0 ? (
          <>
            <span className="text-sm font-medium">
              {selectedCount}{" "}
              {selectedCount !== 1 ? t("experimentDataTable.rows") : t("experimentDataTable.row")}{" "}
              {t("experimentDataAnnotations.bulkActions.selected")}
            </span>
            {totalComments > 0 && (
              <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>
                  {totalComments} comment{totalComments !== 1 ? "s" : ""}
                </span>
              </div>
            )}
            {totalFlags > 0 && (
              <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Flag className="h-3.5 w-3.5" />
                <span>
                  {totalFlags} flag{totalFlags !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </>
        ) : (
          <span className="text-muted-foreground text-sm">
            {t("experimentDataAnnotations.bulkActions.noRowsSelected")}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={downloadTable}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          {t("experimentDataTable.download")}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              {t("experimentDataAnnotations.bulkActions.actions")}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => onAddAnnotation(rowIds, "comment")}
              disabled={selectedCount === 0}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              {t("experimentDataAnnotations.bulkActions.addComment")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onAddAnnotation(rowIds, "flag")}
              disabled={selectedCount === 0}
            >
              <Flag className="mr-2 h-4 w-4" />
              {t("experimentDataAnnotations.bulkActions.addFlag")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDeleteAnnotations(rowIds, "comment")}
              disabled={totalComments === 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("experimentDataAnnotations.bulkActions.removeAllComments")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDeleteAnnotations(rowIds, "flag")}
              disabled={totalFlags === 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("experimentDataAnnotations.bulkActions.removeAllFlags")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
