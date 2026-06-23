"use client";

import { useExperimentVisualizationDelete } from "@/hooks/experiment/useExperimentVisualizationDelete/useExperimentVisualizationDelete";
import { useLocale } from "@/hooks/useLocale";
import { parseApiError } from "@/util/apiError";
import { ChevronDown, Eraser, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFormContext } from "react-hook-form";

import type { ExperimentVisualization } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { toast } from "@repo/ui/hooks/use-toast";

import type { ChartFormValues } from "../../charts/chart-config";
import { getChartTypeDef } from "../../charts/chart-registry";

export interface VisualizationSettingsMenuProps {
  experimentId: string;
  visualization: ExperimentVisualization;
}

export function VisualizationSettingsMenu({
  experimentId,
  visualization,
}: VisualizationSettingsMenuProps) {
  const { t } = useTranslation("experimentVisualizations");
  const { t: tCommon } = useTranslation("common");
  const router = useRouter();
  const locale = useLocale();
  const form = useFormContext<ChartFormValues>();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isClearOpen, setIsClearOpen] = useState(false);

  const { mutate: deleteVisualization, isPending: isDeleting } = useExperimentVisualizationDelete({
    experimentId,
    onSuccess: () => {
      setIsDeleteOpen(false);
      router.push(`/${locale}/platform/experiments/${experimentId}`);
    },
  });

  const handleClear = () => {
    const def = getChartTypeDef(form.getValues("chartType"));
    const tableName = form.getValues("dataConfig.tableName");
    form.setValue("config", def.defaultConfig(), { shouldDirty: true });
    form.setValue("dataConfig", def.defaultDataConfig(tableName), { shouldDirty: true });
    setIsClearOpen(false);
  };

  const handleConfirmDelete = () => {
    deleteVisualization(
      { params: { id: experimentId, visualizationId: visualization.id } },
      {
        onError: (err) => {
          const message = parseApiError(err)?.message ?? tCommon("ui.actions.error");
          toast({
            title: t("workspace.detailsSidebar.deleteVisualization"),
            description: message,
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label={t("ui.actions.title")}>
            {t("ui.actions.title")}
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => setIsClearOpen(true)}>
            <Eraser className="mr-2 h-4 w-4" />
            {t("workspace.detailsSidebar.clearVisualization")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setIsDeleteOpen(true)}
            className="focus:text-destructive focus:bg-destructive/10 group"
          >
            <Trash2 className="text-muted-foreground group-focus:text-destructive mr-2 h-4 w-4" />
            {t("workspace.detailsSidebar.deleteVisualization")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isClearOpen} onOpenChange={setIsClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("workspace.detailsSidebar.clearVisualization")}</DialogTitle>
            <DialogDescription>{t("workspace.detailsSidebar.clearWarning")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsClearOpen(false)}>
              {tCommon("common.cancel")}
            </Button>
            <Button onClick={handleClear}>{t("workspace.detailsSidebar.clearConfirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              {t("workspace.detailsSidebar.deleteVisualization")}
            </DialogTitle>
            <DialogDescription>
              {tCommon("common.confirmDelete", { name: visualization.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              {tCommon("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting
                ? tCommon("ui.actions.deleting")
                : t("workspace.detailsSidebar.deleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
