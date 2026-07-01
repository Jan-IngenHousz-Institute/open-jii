"use client";

import { InlineEditableTitle } from "@/components/shared/inline-editable-title";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useLocale } from "@/hooks/useLocale";
import { formatDate } from "@/util/date";
import { ChevronLeft, Eye, Pencil } from "lucide-react";
import Link from "next/link";
import { useFormContext, useWatch } from "react-hook-form";

import type { ExperimentDashboard } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Textarea } from "@repo/ui/components/textarea";

import { AutosaveIndicator } from "../shared/autosave/autosave-indicator";
import type { DashboardFormValues } from "./dashboard-form-shell";
import { DashboardGradientBody } from "./dashboard-gradient-body";
import { useDashboardMode } from "./dashboard-mode-context";
import { MetaField } from "./meta-field";

interface DashboardLayoutContentProps {
  experimentId: string;
  dashboard: ExperimentDashboard;
  children: React.ReactNode;
}

export function DashboardLayoutContent({
  experimentId,
  dashboard,
  children,
}: DashboardLayoutContentProps) {
  const { t } = useTranslation("experimentDashboards");
  const { t: tCommon } = useTranslation("common");
  const locale = useLocale();
  const form = useFormContext<DashboardFormValues>();
  const { mode, toggleMode } = useDashboardMode();

  const { data: accessData } = useExperimentAccess(experimentId);
  const canEdit = accessData?.isAdmin ?? false;
  const isEditing = canEdit && mode === "edit";

  const name = useWatch({ control: form.control, name: "name" });
  const description = useWatch({ control: form.control, name: "description" }) ?? "";

  const handleTitleSave = (newName: string): Promise<void> => {
    form.setValue("name", newName, { shouldDirty: true, shouldTouch: true });
    return Promise.resolve();
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    form.setValue("description", e.target.value, { shouldDirty: true, shouldTouch: true });
  };

  const backHref = `/${locale}/platform/experiments/${experimentId}/dashboards`;
  const createdByDisplay = dashboard.createdByName ?? "-";

  const ToggleModeIcon = isEditing ? Eye : Pencil;
  const toggleModeLabel = isEditing ? t("ui.actions.done") : t("ui.actions.edit");
  const showStaticDescription = !isEditing && description !== "";

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex w-full flex-col gap-6">
        <Link
          href={backHref}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("ui.actions.back")}
        </Link>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <InlineEditableTitle
                name={name || t("form.namePlaceholder")}
                hasAccess={isEditing}
                onSave={handleTitleSave}
              />
            </div>
            <div className="flex items-center gap-3">
              {isEditing && <AutosaveIndicator />}
              {canEdit && (
                <Button variant="outline" size="sm" onClick={toggleMode}>
                  <ToggleModeIcon className="mr-2 size-4" />
                  {toggleModeLabel}
                </Button>
              )}
            </div>
          </div>

          {isEditing && (
            <Textarea
              value={description}
              onChange={handleDescriptionChange}
              placeholder={t("form.descriptionPlaceholder")}
              rows={1}
              className="min-h-0 resize-none border-0 bg-transparent p-0 text-base text-[#68737B] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          )}
          {showStaticDescription && <p className="text-base text-[#68737B]">{description}</p>}
        </div>

        <div className="flex items-start gap-10 border-b border-[#EDF2F6] pb-8">
          <MetaField label={tCommon("common.created")} value={formatDate(dashboard.createdAt)} />
          <MetaField label={tCommon("common.updated")} value={formatDate(dashboard.updatedAt)} />
          <MetaField label={tCommon("common.createdBy")} value={createdByDisplay} />
        </div>
      </div>

      <DashboardGradientBody experimentId={experimentId} isEditing={isEditing}>
        {children}
      </DashboardGradientBody>
    </div>
  );
}
