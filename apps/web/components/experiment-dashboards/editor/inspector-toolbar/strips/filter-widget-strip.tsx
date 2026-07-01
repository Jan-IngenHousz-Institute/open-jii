"use client";

import { useFormContext } from "react-hook-form";

import type { ExperimentFilterWidget } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";
import { useTranslation } from "@repo/i18n";

import type { DashboardFormValues } from "../../../dashboard-form-shell";
import type { StripOverflowItem } from "../strip-overflow-list";
import { StripOverflowList } from "../strip-overflow-list";
import { WidgetDisplayPopover } from "./widget-display-popover";

interface FilterWidgetStripProps {
  widget: ExperimentFilterWidget;
  widgetIndex: number;
}

// Filter-widget Widget section: just the display popover; source/column/operator
// live under Data. StripOverflowList wrap keeps shape parity with other strips.
export function FilterWidgetStrip({ widget, widgetIndex }: FilterWidgetStripProps) {
  const { t } = useTranslation("experimentDashboards");
  const form = useFormContext<DashboardFormValues>();

  const setConfig = (next: Partial<ExperimentFilterWidget["config"]>) => {
    form.setValue(
      `widgets.${widgetIndex}.config`,
      { ...widget.config, ...next },
      { shouldDirty: true },
    );
  };

  const items: StripOverflowItem[] = [
    {
      key: "display",
      node: (
        <WidgetDisplayPopover
          widgetId={widget.id}
          showTitle={widget.config.showTitle}
          showDescription={widget.config.showDescription}
          title={widget.config.title ?? ""}
          description={widget.config.description ?? ""}
          titlePlaceholder={widget.config.column ?? t("editor.filterConfig.titlePlaceholder")}
          onShowTitleChange={(value) => setConfig({ showTitle: value })}
          onShowDescriptionChange={(value) => setConfig({ showDescription: value })}
          onTitleChange={(value) => setConfig({ title: value || undefined })}
          onDescriptionChange={(value) => setConfig({ description: value || undefined })}
        />
      ),
    },
  ];

  return <StripOverflowList items={items} />;
}
