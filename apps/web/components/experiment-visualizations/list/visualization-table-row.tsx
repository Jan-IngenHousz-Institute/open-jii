"use client";

import { useExperimentVisualizationDelete } from "@/hooks/experiment/useExperimentVisualizationDelete/useExperimentVisualizationDelete";
import { formatDate } from "@/util/date";
import { initialsOf } from "@/util/initials";
import { Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type {
  ExperimentChartFamily,
  ExperimentChartType,
  ExperimentVisualization,
} from "@repo/api/domains/experiment/experiment.schema";
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

import { getChartTypeDef } from "../charts/chart-registry";

// Type-pill background keyed off chart family so the list scales without
// per-type bookkeeping. Unsupported types fall through to the neutral token.
const FAMILY_BADGE_CLASS: Record<ExperimentChartFamily, string> = {
  basic: "bg-badge-published",
  statistical: "bg-badge-stale",
  scientific: "bg-badge-archived",
  "3d": "bg-badge-archived",
};

export interface VisualizationTableRowProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  basePath: string;
}

export function VisualizationTableRow({
  visualization,
  experimentId,
  basePath,
}: VisualizationTableRowProps) {
  const { t } = useTranslation("experimentVisualizations");
  const { t: tCommon } = useTranslation("common");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { mutate: deleteVisualization, isPending: isDeleting } = useExperimentVisualizationDelete({
    experimentId,
    onSuccess: () => {
      toast({ title: t("ui.messages.deleteSuccess") });
      setConfirmingDelete(false);
    },
  });

  const viewHref = `/platform/${basePath}/${experimentId}/analysis/visualizations/${visualization.id}`;
  const author = visualization.createdByName ?? `${visualization.createdBy.slice(0, 8)}…`;
  const def = getChartTypeDef(visualization.chartType);
  const typeLabel = t(def.labelKey);
  const typeBadgeClass = badgeClassFor(visualization.chartType);

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    deleteVisualization({
      id: experimentId,
      visualizationId: visualization.id,
    });
  };

  const handleOpenDeleteDialog = (e: Event) => {
    e.preventDefault();
    setConfirmingDelete(true);
  };

  return (
    <>
      <TableRow className="group border-[#CDD5DB] bg-white hover:bg-[#F6F8FA]">
        <TableCell className="px-6 py-3 text-[13px] font-semibold text-[#011111]">
          <Link
            href={viewHref}
            className="focus-visible:ring-primary/40 focus-visible:outline-hidden hover:underline focus-visible:ring-2"
          >
            {visualization.name}
          </Link>
        </TableCell>
        <TableCell className="px-6 py-3">
          <span
            className={cn(
              "text-muted-dark inline-block rounded-full px-2 py-0.5 text-[11px] font-medium",
              typeBadgeClass,
            )}
          >
            {typeLabel}
          </span>
        </TableCell>
        <TableCell className="px-6 py-3">
          <div className="flex items-center gap-2">
            <Avatar className="size-6">
              <AvatarFallback className="text-[10px] font-medium text-[#68737B]">
                {initialsOf(author)}
              </AvatarFallback>
            </Avatar>
            <span className="text-[13px] text-[#68737B]">{author}</span>
          </div>
        </TableCell>
        <TableCell className="px-6 py-3 text-[13px] tabular-nums text-[#68737B]">
          {formatDate(visualization.updatedAt)}
        </TableCell>
        <TableCell className="w-12 px-3 py-3 text-right">
          <div className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t("ui.actions.moreActions")}
                  className="hover:bg-accent data-[state=open]:bg-accent inline-flex size-8 items-center justify-center rounded-md text-[#68737B] hover:text-[#011111] data-[state=open]:text-[#011111]"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={viewHref}>
                    <Pencil className="mr-2 size-4" />
                    {t("ui.actions.edit")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={handleOpenDeleteDialog}
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
              {t("ui.messages.deleteConfirm", { name: visualization.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{tCommon("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={handleConfirmDelete}
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

function badgeClassFor(chartType: ExperimentChartType): string {
  return FAMILY_BADGE_CLASS[getChartTypeDef(chartType).family];
}
