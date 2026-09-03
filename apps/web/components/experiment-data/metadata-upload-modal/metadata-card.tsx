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
import { Card } from "@repo/ui/components/card";
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
    <Card
      className={cn(
        "flex-row items-center gap-3 px-3 py-2.5 transition-all duration-500",
        deleteStatus === "deleted" &&
          "max-h-0 scale-95 overflow-hidden border-transparent py-0 opacity-0",
      )}
      style={deleteStatus !== "deleted" ? { maxHeight: 200 } : undefined}
    >
      <div className="bg-muted shrink-0 rounded-md p-1.5">
        <TableProperties className="text-muted-foreground h-4 w-4" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-foreground truncate text-sm font-semibold">
          {name ?? "Untitled metadata"}
        </p>
        {columnNames.length > 0 && (
          <p className="text-muted-foreground truncate text-xs">
            {columnNames.length <= 5
              ? columnNames.join(", ")
              : t("uploadModal.metadata.columnsTruncated", {
                  columns: columnNames.slice(0, 4).join(", "),
                  count: columnNames.length - 4,
                })}
          </p>
        )}

        <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
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

      <div className="flex shrink-0 gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onEdit}
          disabled={deleteStatus !== "idle"}
        >
          <Pencil className="text-muted-foreground h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onDelete}
          disabled={deleteStatus !== "idle"}
        >
          {deleteStatus === "deleted" ? (
            <Check className="animate-in zoom-in-0 text-status-active-foreground h-4 w-4 duration-300" />
          ) : deleteStatus === "deleting" ? (
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="text-destructive h-4 w-4" />
          )}
        </Button>
      </div>
    </Card>
  );
}
