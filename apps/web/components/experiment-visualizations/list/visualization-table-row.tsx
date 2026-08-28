"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import type { StatusTone } from "@/components/shared/status-badge";
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
} from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
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
import { Button } from "@repo/ui/components/button";
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
} from "../../experiment-dashboards/list/table/experiment-dashboards-list-tokens";
import { getChartTypeDef } from "../charts/chart-registry";

// Type-pill tone keyed off chart family so the list scales without per-type
// bookkeeping. Unsupported types fall through to the neutral tone.
const FAMILY_BADGE_TONE: Record<ExperimentChartFamily, StatusTone> = {
  basic: "published",
  statistical: "stale",
  scientific: "archived",
  "3d": "archived",
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
  const typeBadgeTone = badgeToneFor(visualization.chartType);

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
      <TableRow className={cn("bg-card hover:bg-muted group", LIST_TABLE_BORDER)}>
        <TableCell className={cn("px-6 py-3 text-[13px] font-semibold", LIST_TEXT_STRONG)}>
          <Link
            href={viewHref}
            className="focus-visible:ring-primary/40 focus-visible:outline-hidden hover:underline focus-visible:ring-2"
          >
            {visualization.name}
          </Link>
        </TableCell>
        <TableCell className="px-6 py-3">
          <StatusBadge tone={typeBadgeTone}>{typeLabel}</StatusBadge>
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
          {formatDate(visualization.updatedAt)}
        </TableCell>
        <TableCell className="w-12 px-3 py-3 text-right">
          <div className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("ui.actions.moreActions")}
                  className={cn("data-[state=open]:bg-accent size-8", LIST_TEXT_MUTED)}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={viewHref}>
                    <Pencil className="mr-2 size-4" />
                    {t("ui.actions.edit")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={handleOpenDeleteDialog}>
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

function badgeToneFor(chartType: ExperimentChartType): StatusTone {
  return FAMILY_BADGE_TONE[getChartTypeDef(chartType).family];
}
