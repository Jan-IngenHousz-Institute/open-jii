import { MessageSquare, Flag, ChevronDown, Trash2 } from "lucide-react";
import React from "react";
import { AddCommentDialog } from "~/components/experiment-data/comments/add-comment-dialog";
import { DeleteCommentsDialog } from "~/components/experiment-data/comments/delete-comment-dialog";

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
  totalFlags: number;
  clearSelection: () => void;
}

export function BulkActionsBar({
  experimentId,
  tableName,
  rowIds,
  totalComments,
  totalFlags,
  clearSelection,
}: BulkActionsBarProps) {
  const { t } = useTranslation();
  const selectedCount = rowIds.length;
  const [showAddBulkAddCommentDialog, setShowAddBulkCommentDialog] = React.useState(false);
  const [showAddBulkFlagDialog, setShowAddBulkFlagDialog] = React.useState(false);
  const [showDeleteBulkCommentsDialog, setShowDeleteBulkCommentsDialog] = React.useState(false);
  const [showDeleteBulkFlagsDialog, setShowDeleteBulkFlagsDialog] = React.useState(false);

  return (
    <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-blue-900">
          {selectedCount}{" "}
          {selectedCount !== 1 ? t("experimentDataTable.rows") : t("experimentDataTable.row")}{" "}
          {t("experimentDataComments.bulkActions.selected")}
        </span>
        {(totalComments > 0 || totalFlags > 0) && (
          <div className="flex items-center gap-2 text-xs text-blue-700">
            {totalComments > 0 && (
              <span className="flex items-center">
                <MessageSquare className="mr-1 h-3 w-3" />
                {totalComments} comment{totalComments !== 1 ? "s" : ""}
              </span>
            )}
            {totalFlags > 0 && (
              <span className="flex items-center">
                <Flag className="mr-1 h-3 w-3" />
                {totalFlags} flag{totalFlags !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              {t("experimentDataComments.bulkActions.actions")}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => setShowAddBulkCommentDialog(true)}
              disabled={selectedCount === 0}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              {t("experimentDataComments.bulkActions.addComment")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setShowAddBulkFlagDialog(true)}
              disabled={selectedCount === 0}
            >
              <Flag className="mr-2 h-4 w-4" />
              {t("experimentDataComments.bulkActions.addFlag")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setShowDeleteBulkCommentsDialog(true)}
              disabled={totalComments === 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("experimentDataComments.bulkActions.removeAllComments")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setShowDeleteBulkFlagsDialog(true)}
              disabled={totalFlags === 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("experimentDataComments.bulkActions.removeAllFlags")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <AddCommentDialog
        experimentId={experimentId}
        tableName={tableName}
        rowIds={rowIds}
        type="comment"
        bulk={true}
        bulkOpen={showAddBulkAddCommentDialog}
        setBulkOpen={setShowAddBulkCommentDialog}
        clearSelection={clearSelection}
      />
      <AddCommentDialog
        experimentId={experimentId}
        tableName={tableName}
        rowIds={rowIds}
        type="flag"
        bulk={true}
        bulkOpen={showAddBulkFlagDialog}
        setBulkOpen={setShowAddBulkFlagDialog}
        clearSelection={clearSelection}
      />
      <DeleteCommentsDialog
        experimentId={experimentId}
        tableName={tableName}
        rowIds={rowIds}
        type="comment"
        bulkOpen={showDeleteBulkCommentsDialog}
        setBulkOpen={setShowDeleteBulkCommentsDialog}
        clearSelection={clearSelection}
      />
      <DeleteCommentsDialog
        experimentId={experimentId}
        tableName={tableName}
        rowIds={rowIds}
        type="flag"
        bulkOpen={showDeleteBulkFlagsDialog}
        setBulkOpen={setShowDeleteBulkFlagsDialog}
        clearSelection={clearSelection}
      />
    </div>
  );
}
