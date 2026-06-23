"use client";

import { Filter } from "lucide-react";
import { useFormContext } from "react-hook-form";

import type { ExperimentDataFilterValue, ExperimentFilterWidget } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";

import { FilterValueInput } from "../../../data-filters/value-input";
import type { DashboardFormValues } from "../../dashboard-form-shell";
import { useFilterWidgetConfig } from "./use-filter-widget-config";

interface FilterWidgetEditorProps {
  widget: ExperimentFilterWidget;
  experimentId: string;
  widgetIndex: number;
}

export function FilterWidgetEditor({ widget, experimentId, widgetIndex }: FilterWidgetEditorProps) {
  const { t } = useTranslation("experimentDashboards");
  const form = useFormContext<DashboardFormValues>();
  const { tableName, operator, column, operatorLabel, displayTitle } = useFilterWidgetConfig(
    widget,
    experimentId,
  );

  const handleChange = (next: ExperimentDataFilterValue) => {
    form.setValue(
      `widgets.${widgetIndex}.config`,
      { ...widget.config, defaultValue: next },
      { shouldDirty: true },
    );
  };

  if (!tableName || !operator || !displayTitle) {
    return (
      <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
        <div className="bg-muted/40 flex size-10 items-center justify-center rounded-full">
          <Filter className="size-5" />
        </div>
        <div className="text-foreground text-sm font-medium">
          {t("editor.filterConfig.configureLabel")}
        </div>
        <p className="text-xs">{t("editor.filterConfig.configureHint")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex min-w-0 items-baseline gap-1.5">
        <span className="truncate text-sm font-medium">{displayTitle}</span>
        <span className="text-muted-foreground shrink-0 text-xs">{operatorLabel}</span>
      </div>
      <FilterValueInput
        column={column}
        operator={operator}
        value={widget.config.defaultValue ?? ""}
        onChange={handleChange}
        experimentId={experimentId}
        tableName={tableName}
      />
      <p className="text-muted-foreground/80 text-[10px]">
        {t("editor.filterConfig.defaultValueHint")}
      </p>
    </div>
  );
}
