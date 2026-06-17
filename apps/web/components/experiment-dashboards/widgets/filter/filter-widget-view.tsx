"use client";

import { Filter, RotateCcw } from "lucide-react";

import type { FilterWidget } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { FilterValueInput } from "../../../data-filters/value-input";
import { useDashboardFilterWidget } from "../../dashboard-filters-context";
import { WidgetEmptyState } from "../shell/widget-empty-state";
import { WidgetHeader } from "../shell/widget-header";
import { useFilterWidgetConfig } from "./use-filter-widget-config";

interface FilterWidgetViewProps {
  widget: FilterWidget;
  experimentId: string;
}

export function FilterWidgetView({ widget, experimentId }: FilterWidgetViewProps) {
  const { t } = useTranslation("experimentDashboards");
  const { value, setValue, isOverridden, reset } = useDashboardFilterWidget(widget.id);
  const { tableName, operator, column, operatorLabel, displayTitle } = useFilterWidgetConfig(
    widget,
    experimentId,
  );

  if (!tableName || !operator || !displayTitle) {
    return (
      <WidgetEmptyState
        icon={Filter}
        title={t("widget.emptyFilter")}
        description={t("widget.emptyFilterDescription")}
      />
    );
  }

  const trailing = (
    <>
      <span className="text-muted-foreground shrink-0 text-xs">{operatorLabel}</span>
      {isOverridden && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground -mr-1 h-6 gap-1 px-1.5 text-[11px]"
          onClick={reset}
          title={t("widget.filterResetTitle")}
        >
          <RotateCcw className="h-3 w-3" />
          {t("widget.filterReset")}
        </Button>
      )}
    </>
  );

  const showTitle = widget.config.showTitle;
  const showDescription = widget.config.showDescription;
  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <WidgetHeader
        title={showTitle ? displayTitle : null}
        description={showDescription ? widget.config.description : null}
        trailing={trailing}
      />
      <FilterValueInput
        column={column}
        operator={operator}
        value={value ?? ""}
        onChange={setValue}
        experimentId={experimentId}
        tableName={tableName}
      />
    </div>
  );
}
