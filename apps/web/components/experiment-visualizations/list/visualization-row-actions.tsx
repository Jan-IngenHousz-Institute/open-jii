"use client";

import { IntentLink } from "@/components/navigation/intent-link/intent-link";
import { overviewTableText } from "@/components/overview-table/overview-table";
import { useExperimentVisualizationDelete } from "@/hooks/experiment/useExperimentVisualizationDelete/useExperimentVisualizationDelete";
import { Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import type { ExperimentVisualization } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
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
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { toast } from "@repo/ui/hooks/use-toast";
import { cn } from "@repo/ui/lib/utils";

export interface VisualizationRowActionsProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  /** The chart's page, which is also where it is edited. */
  href: string;
}

/** A chart row's ⋯ menu, with Edit and a confirmed Delete. */
export function VisualizationRowActions({
  visualization,
  experimentId,
  href,
}: VisualizationRowActionsProps) {
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

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    deleteVisualization({ id: experimentId, visualizationId: visualization.id });
  };

  const handleOpenDeleteDialog = (e: Event) => {
    e.preventDefault();
    setConfirmingDelete(true);
  };

  return (
    // The row navigates on click, and React bubbles the dialog's clicks through its portal.
    <div
      className="flex justify-end opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-state=open]]:opacity-100"
      onClick={(e) => e.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("ui.actions.moreActions")}
            className={cn("data-[state=open]:bg-accent size-8", overviewTableText.muted)}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <IntentLink href={href}>
              <Pencil className="mr-2 size-4" />
              {t("ui.actions.edit")}
            </IntentLink>
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={handleOpenDeleteDialog}>
            <Trash2 className="mr-2 size-4" />
            {t("ui.actions.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
    </div>
  );
}
