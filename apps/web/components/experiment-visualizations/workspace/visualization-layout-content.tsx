"use client";

import { InlineEditableTitle } from "@/components/shared/inline-editable-title";
import { useExperimentVisualizationDelete } from "@/hooks/experiment/useExperimentVisualizationDelete/useExperimentVisualizationDelete";
import { useLocale } from "@/hooks/useLocale";
import { formatDate } from "@/util/date";
import { AlertCircle, CheckCircle2, ChevronDown, Eraser, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { ExperimentVisualization } from "@repo/api/schemas/experiment.schema";
import { useSession } from "@repo/auth/client";
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
import { Textarea } from "@repo/ui/components/textarea";

import type { ChartFormValues } from "../charts/form-values";
import { getChartTypeDef } from "../charts/registry";
import { useVisualizationSaveStatus } from "./save-context";

interface VisualizationLayoutContentProps {
  experimentId: string;
  visualization: ExperimentVisualization;
  children: React.ReactNode;
}

export function VisualizationLayoutContent({
  experimentId,
  visualization,
  children,
}: VisualizationLayoutContentProps) {
  const { t } = useTranslation("experimentVisualizations");
  const { data: session } = useSession();
  const form = useFormContext<ChartFormValues>();

  const isCreator = session?.user.id === visualization.createdBy;
  const name = useWatch({ control: form.control, name: "name" });
  const description = useWatch({ control: form.control, name: "description" }) ?? "";

  // InlineEditableTitle expects an async onSave; the actual setValue is
  // synchronous so we just resolve immediately.
  const handleTitleSave = (newName: string): Promise<void> => {
    form.setValue("name", newName, { shouldDirty: true, shouldTouch: true });
    return Promise.resolve();
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <InlineEditableTitle
                name={name || t("workspace.layout.untitled")}
                hasAccess={isCreator}
                onSave={handleTitleSave}
              />
            </div>
            <div className="flex items-center gap-3">
              <SaveIndicator />
              {isCreator && (
                <SettingsMenu experimentId={experimentId} visualization={visualization} />
              )}
            </div>
          </div>

          <Textarea
            value={description}
            onChange={(e) => {
              form.setValue("description", e.target.value, {
                shouldDirty: true,
                shouldTouch: true,
              });
            }}
            placeholder={t("workspace.layout.descriptionPlaceholder")}
            aria-label={t("workspace.layout.descriptionTitle")}
            disabled={!isCreator}
            rows={1}
            className="min-h-0 resize-none border-0 bg-transparent p-0 text-base text-[#68737B] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        <div className="flex items-start gap-10 border-b border-[#EDF2F6] pb-8">
          <MetaField
            label={t("workspace.detailsSidebar.createdAt")}
            value={formatDate(visualization.createdAt)}
          />
          <MetaField
            label={t("workspace.detailsSidebar.updatedAt")}
            value={formatDate(visualization.updatedAt)}
          />
          <MetaField
            label={t("workspace.detailsSidebar.createdBy")}
            value={visualization.createdByName ?? "—"}
          />
          <MetaField
            label={t("workspace.detailsSidebar.dataSource")}
            value={visualization.dataConfig.tableName || t("workspace.detailsSidebar.noDataSource")}
            mono
          />
        </div>
      </div>

      <div
        className="-mx-6 -mb-6 flex-1 border-t border-[#EDF2F6] px-6 pb-6"
        style={{ background: "linear-gradient(270.03deg, #F5FFF8 0%, #F4F9FF 100%)" }}
      >
        <div className="mx-auto w-full max-w-7xl pt-6">{children}</div>
      </div>
    </div>
  );
}

function MetaField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium leading-[18px] tracking-[0.02em] text-[#011111]">
        {label}
      </span>
      <span className={`text-sm leading-[21px] text-[#68737B] ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function SaveIndicator() {
  const { isSaving, isDirty, hasError } = useVisualizationSaveStatus();
  const { t } = useTranslation("experimentVisualizations");

  if (hasError) {
    return (
      <div className="flex items-center gap-2 text-[15px]">
        <AlertCircle className="text-destructive size-4" />
        <span className="text-destructive">{t("workspace.layout.saveFailed")}</span>
      </div>
    );
  }

  if (isSaving || isDirty) {
    return (
      <div className="flex items-center gap-2 text-[15px]">
        <Loader2 className="size-4 animate-spin text-[#68737B]" />
        <span className="text-[#011111]">{t("workspace.layout.saving")}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-[15px]">
      <CheckCircle2 className="size-4 text-emerald-500" />
      <span className="text-[#68737B]">{t("workspace.layout.allChangesSaved")}</span>
    </div>
  );
}

interface SettingsMenuProps {
  experimentId: string;
  visualization: ExperimentVisualization;
}

function SettingsMenu({ experimentId, visualization }: SettingsMenuProps) {
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

  // "Clear" resets data + style to the active chart type's defaults while
  // preserving the visualization's identity (name, description, chart type).
  // Same pattern as the chart-type switch: setValue per top-level field so
  // the autosave watch sees consistent change events and persists the new
  // state. Re-using `getChartTypeDef(currentChartType)` means clearing
  // stays in sync if the registry changes its defaults.
  const handleClear = () => {
    const currentChartType = form.getValues("chartType");
    const def = getChartTypeDef(currentChartType);
    if (!def) {
      setIsClearOpen(false);
      return;
    }
    const tableName = form.getValues("dataConfig.tableName");
    form.setValue("config", def.defaultConfig(), { shouldDirty: true });
    form.setValue("dataConfig", def.defaultDataConfig(tableName), { shouldDirty: true });
    setIsClearOpen(false);
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
            {t("workspace.detailsSidebar.clearVisualization", "Clear visualization")}
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
            <DialogTitle>
              {t("workspace.detailsSidebar.clearVisualization", "Clear visualization")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "workspace.detailsSidebar.clearWarning",
                "This resets the data sources and style to defaults. The name, description, and chart type are kept.",
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsClearOpen(false)}>
              {tCommon("common.cancel")}
            </Button>
            <Button onClick={handleClear}>
              {t("workspace.detailsSidebar.clearConfirm", "Clear")}
            </Button>
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
            <Button
              variant="destructive"
              onClick={() =>
                deleteVisualization({
                  params: { id: experimentId, visualizationId: visualization.id },
                })
              }
              disabled={isDeleting}
            >
              {isDeleting
                ? tCommon("ui.actions.deleting", "Deleting…")
                : t("workspace.detailsSidebar.deleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
