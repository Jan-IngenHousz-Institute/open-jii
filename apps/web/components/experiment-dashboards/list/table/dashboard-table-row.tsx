"use client";

import { useExperimentDashboardDelete } from "@/hooks/experiment/useExperimentDashboardDelete/useExperimentDashboardDelete";
import { formatDate } from "@/util/date";
import { initialsOf } from "@/util/initials";
import { Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { ExperimentDashboard } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { TableCell, TableRow } from "@repo/ui/components/table";
import { toast } from "@repo/ui/hooks/use-toast";
import { cn } from "@repo/ui/lib/utils";

import {
  LIST_TABLE_BORDER,
  LIST_TEXT_MUTED,
  LIST_TEXT_STRONG,
} from "./experiment-dashboards-list-tokens";

export interface DashboardTableRowProps {
  dashboard: ExperimentDashboard;
  experimentId: string;
  basePath: string;
}

export function DashboardTableRow({ dashboard, experimentId, basePath }: DashboardTableRowProps) {
  const { t } = useTranslation("experimentDashboards");
  const { t: tCommon } = useTranslation("common");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { mutate: deleteDashboard, isPending: isDeleting } = useExperimentDashboardDelete({
    experimentId,
    onSuccess: () => {
      toast({ title: t("ui.messages.deleteSuccess") });
      setConfirmingDelete(false);
    },
  });

  const viewHref = `/platform/${basePath}/${experimentId}/dashboards/${dashboard.id}`;
  const editHref = `/platform/${basePath}/${experimentId}/dashboards/${dashboard.id}?edit=1`;
  const widgetCount = dashboard.widgets.length;
  const author = dashboard.createdByName ?? `${dashboard.createdBy.slice(0, 8)}…`;

  const handleDeleteSelect = (e: Event) => {
    e.preventDefault();
    setConfirmingDelete(true);
  };

  const handleDeleteConfirm = (e: React.MouseEvent) => {
    e.preventDefault();
    deleteDashboard({
      params: { id: experimentId, dashboardId: dashboard.id },
    });
  };

  return (
    <>
      <TableRow className={cn("group bg-white hover:bg-[#F6F8FA]", LIST_TABLE_BORDER)}>
        <TableCell className={cn("px-6 py-3 text-[13px] font-semibold", LIST_TEXT_STRONG)}>
          <Link
            href={viewHref}
            className="focus-visible:ring-primary/40 hover:underline focus-visible:outline-none focus-visible:ring-2"
          >
            {dashboard.name}
          </Link>
        </TableCell>
        <TableCell className={cn("px-6 py-3 text-[13px]", LIST_TEXT_MUTED)}>
          {widgetCount}
        </TableCell>
        <TableCell className="px-6 py-3">
          <div className="flex items-center gap-2">
            <Avatar className="size-6">
              <AvatarFallback className={cn("text-[10px] font-medium", LIST_TEXT_MUTED)}>
                {initialsOf(author)}
              </AvatarFallback>
            </Avatar>
            <span className={cn("text-[13px]", LIST_TEXT_MUTED)}>{author}</span>
          </div>
        </TableCell>
        <TableCell className={cn("px-6 py-3 text-[13px] tabular-nums", LIST_TEXT_MUTED)}>
          {formatDate(dashboard.updatedAt)}
        </TableCell>
        <TableCell className="w-12 px-3 py-3 text-right">
          <div className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t("ui.actions.edit")}
                  className={cn(
                    "hover:bg-accent data-[state=open]:bg-accent inline-flex size-8 items-center justify-center rounded-md hover:text-[#011111] data-[state=open]:text-[#011111]",
                    LIST_TEXT_MUTED,
                  )}
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={editHref}>
                    <Pencil className="mr-2 size-4" />
                    {t("ui.actions.edit")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={handleDeleteSelect}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 size-4" />
                  {t("ui.actions.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("ui.actions.delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("ui.messages.deleteConfirm", { name: dashboard.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{tCommon("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="size-4 animate-spin" /> : t("ui.actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
