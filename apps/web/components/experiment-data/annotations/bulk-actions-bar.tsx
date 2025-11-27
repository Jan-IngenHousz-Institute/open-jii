import { MessageSquare, ChevronDown, Trash2, Download } from "lucide-react";
import React from "react";
import { AddAnnotationDialog } from "~/components/experiment-data/annotations/add-annotation-dialog";
import { DeleteAnnotationsDialog } from "~/components/experiment-data/annotations/delete-annotations-dialog";

import { useTranslation } from "@repo/i18n";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components";

interface BulkActionsBarProps {
  experimentId: string;
  tableName: string;
  rowIds: string[];
  totalComments: number;
  clearSelection: () => void;
  downloadTable: () => void;
}

export function BulkActionsBar({
  experimentId,
  tableName,
  rowIds,
  totalComments,
  clearSelection,
  downloadTable,
}: BulkActionsBarProps) {
  const { t } = useTranslation();
  const selectedCount = rowIds.length;
  const [showAddBulkCommentDialog, setShowAddBulkCommentDialog] = React.useState(false);
  const [showDeleteBulkCommentsDialog, setShowDeleteBulkCommentsDialog] = React.useState(false);

  return (
    <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-blue-900">
          {selectedCount}{" "}
          {selectedCount !== 1 ? t("experimentDataTable.rows") : t("experimentDataTable.row")}{" "}
          {t("experimentDataAnnotations.bulkActions.selected")}
        </span>
        {totalComments > 0 && (
          <div className="flex items-center gap-2 text-xs text-blue-700">
            {totalComments > 0 && (
              <span className="flex items-center">
                <MessageSquare className="mr-1 h-3 w-3" />
                {totalComments} comment{totalComments !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
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
              onClick={() => setShowAddBulkCommentDialog(true)}
              disabled={selectedCount === 0}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              {t("experimentDataAnnotations.bulkActions.addComment")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setShowDeleteBulkCommentsDialog(true)}
              disabled={totalComments === 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("experimentDataAnnotations.bulkActions.removeAllComments")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <AddAnnotationDialog
        experimentId={experimentId}
        tableName={tableName}
        rowIds={rowIds}
        type="comment"
        bulk={true}
        bulkOpen={showAddBulkCommentDialog}
        setBulkOpen={setShowAddBulkCommentDialog}
        clearSelection={clearSelection}
      />
      <DeleteAnnotationsDialog
        experimentId={experimentId}
        tableName={tableName}
        rowIds={rowIds}
        type="comment"
        bulkOpen={showDeleteBulkCommentsDialog}
        setBulkOpen={setShowDeleteBulkCommentsDialog}
        clearSelection={clearSelection}
      />
    </div>
  );
}
