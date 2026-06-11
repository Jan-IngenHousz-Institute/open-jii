"use client";

import { AutosaveIndicator } from "@/shared/ui/autosave/autosave-indicator";
import { InlineEditableTitle } from "@/shared/ui/inline-editable-title";
import { formatDate } from "@/shared/utils/date";
import { useFormContext, useWatch } from "react-hook-form";

import type { ExperimentVisualization } from "@repo/api/schemas/experiment.schema";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Textarea } from "@repo/ui/components/textarea";

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
            className="min-h-0 resize-none border-0 bg-transparent p-0 text-base text-[#68737B] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        <div className="flex items-start gap-10 border-b border-[#EDF2F6] pb-8">
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

      <div
        className="-mx-6 -mb-6 flex-1 border-t border-[#EDF2F6] px-6 pb-6"
        style={{ background: "linear-gradient(270.03deg, #F5FFF8 0%, #F4F9FF 100%)" }}
      >
        <div className="mx-auto w-full max-w-7xl pt-6">{children}</div>
      </div>
    </div>
  );
}
