import {
  Calendar,
  Check,
  KeyRound,
  Loader2,
  Pencil,
  Rows3,
  TableProperties,
  Trash2,
} from "lucide-react";

import { useTranslation } from "@repo/i18n/client";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

export type DeleteStatus = "idle" | "deleting" | "deleted";

interface MetadataCardProps {
  name: string | undefined;
  identifierColumnId: string | undefined;
  rowCount: number;
  columnNames: string[];
  updatedAt: string;
  onEdit: () => void;
  onDelete: () => void;
  deleteStatus: DeleteStatus;
}

export function MetadataCard({
  name,
  identifierColumnId,
  rowCount,
  columnNames,
  updatedAt,
  onEdit,
  onDelete,
  deleteStatus,
}: MetadataCardProps) {
  const { t } = useTranslation("experiments");
  const dateStr = new Date(updatedAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-l-4 border-l-emerald-500 bg-white px-3 py-2.5 transition-all duration-500 dark:border-gray-700 dark:border-l-emerald-500 dark:bg-gray-800",
        deleteStatus === "deleted" &&
          "max-h-0 scale-95 overflow-hidden border-transparent !border-l-transparent py-0 opacity-0",
      )}
      style={deleteStatus !== "deleted" ? { maxHeight: 200 } : undefined}
    >
      <div className="flex-shrink-0 rounded-md bg-gray-100 p-1.5 dark:bg-gray-700">
        <TableProperties className="h-4 w-4 text-gray-500 dark:text-gray-400" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
          {name ?? "Untitled metadata"}
        </p>
        {columnNames.length > 0 && (
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
            {columnNames.length <= 5
              ? columnNames.join(", ")
              : t("uploadModal.metadata.columnsTruncated", {
                  columns: columnNames.slice(0, 4).join(", "),
                  count: columnNames.length - 4,
                })}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-1">
            <Rows3 className="h-3 w-3" />
            {rowCount} row{rowCount !== 1 ? "s" : ""}
          </span>
          {identifierColumnId && (
            <span className="inline-flex items-center gap-1">
              <KeyRound className="h-3 w-3" />
              {identifierColumnId}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {dateStr}
          </span>
        </div>
      </div>

      <div className="flex flex-shrink-0 gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onEdit}
          disabled={deleteStatus !== "idle"}
        >
          <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onDelete}
          disabled={deleteStatus !== "idle"}
        >
          {deleteStatus === "deleted" ? (
            <Check className="animate-in zoom-in-0 h-4 w-4 text-emerald-500 duration-300" />
          ) : deleteStatus === "deleting" ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          ) : (
            <Trash2 className="text-destructive h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
