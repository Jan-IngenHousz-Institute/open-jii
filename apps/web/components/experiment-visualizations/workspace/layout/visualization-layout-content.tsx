"use client";

import { InlineEditableTitle } from "@/components/shared/inline-editable-title";
import { workspaceBleed } from "@/components/workspace-band";
import { formatDate } from "@/util/date";
import { useFormContext, useWatch } from "react-hook-form";

import type { ExperimentVisualization } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Textarea } from "@repo/ui/components/textarea";
import { cn } from "@repo/ui/lib/utils";

import { AutosaveIndicator } from "../../../shared/autosave/autosave-indicator";
import type { ChartFormValues } from "../../charts/chart-config";
import { VisualizationMetaField } from "./visualization-meta-field";
import { VisualizationSettingsMenu } from "./visualization-settings-menu";

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

  const handleTitleSave = (newName: string): Promise<void> => {
    form.setValue("name", newName, { shouldDirty: true, shouldTouch: true });
    return Promise.resolve();
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    form.setValue("description", e.target.value, { shouldDirty: true, shouldTouch: true });
  };

  const dataSourceLabel =
    visualization.dataConfig.tableName || t("workspace.detailsSidebar.noDataSource");

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex w-full flex-col gap-8">
        <div className="space-y-2">
          {/* Stacked below sm: "All changes saved" plus the menu take ~200px of a
              328px content box, which left a text-2xl title wrapping to three
              lines beside them. */}
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1">
              <InlineEditableTitle
                name={name || t("workspace.layout.untitled")}
                hasAccess={isCreator}
                onSave={handleTitleSave}
              />
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <AutosaveIndicator />
              {isCreator && (
                <VisualizationSettingsMenu
                  experimentId={experimentId}
                  visualization={visualization}
                />
              )}
            </div>
          </div>

          <Textarea
            value={description}
            onChange={handleDescriptionChange}
            placeholder={t("workspace.layout.descriptionPlaceholder")}
            aria-label={t("workspace.layout.descriptionTitle")}
            disabled={!isCreator}
            rows={1}
            // dark:bg-transparent as well as bg-transparent: Textarea's base carries
            // dark:bg-input/30, which an unmodified utility never strips.
            className="text-muted-foreground min-h-0 resize-none border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
          />
        </div>

        {/* No border: the canvas band below draws the full-bleed rule, and the two
            sat flush against each other as one thick inset line over a thin
            full-width one. Two columns on a phone so a long data-source
            identifier cannot set the row's min-content width. */}
        <div className="grid grid-cols-2 gap-x-10 gap-y-4 pb-8 md:flex md:items-start">
          <VisualizationMetaField
            label={t("workspace.detailsSidebar.createdAt")}
            value={formatDate(visualization.createdAt)}
          />
          <VisualizationMetaField
            label={t("workspace.detailsSidebar.updatedAt")}
            value={formatDate(visualization.updatedAt)}
          />
          <VisualizationMetaField
            label={t("workspace.detailsSidebar.createdBy")}
            value={visualization.createdByName ?? "—"}
          />
          <VisualizationMetaField
            label={t("workspace.detailsSidebar.dataSource")}
            value={dataSourceLabel}
            mono
          />
        </div>
      </div>

      <div className={cn("border-border bg-canvas relative flex-1 border-t", workspaceBleed)}>
        <div className="w-full pt-6">{children}</div>
      </div>
    </div>
  );
}
