"use client";

import { Table2 } from "lucide-react";

import type { ExperimentTableWidget } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";
import { useTranslation } from "@repo/i18n";

import { ExpandableWidget } from "../shell/expandable-widget";
import { WidgetEmptyState } from "../shell/widget-empty-state";
import { WidgetHeader } from "../shell/widget-header";
import { LoadedTableView } from "./loaded-table-view";

interface TableWidgetViewProps {
  widget: ExperimentTableWidget;
  experimentId: string;
}

export function TableWidgetView({ widget, experimentId }: TableWidgetViewProps) {
  const { t } = useTranslation("experimentDashboards");
  const tableName = widget.config.tableName;
  const title = widget.config.showTitle ? widget.config.title : undefined;
  const description = widget.config.showDescription ? widget.config.description : undefined;
  const hasHeader = Boolean(title ?? description);
  return (
    <ExpandableWidget title={title ?? tableName ?? null}>
      <div className="flex h-full min-h-0 flex-1 flex-col">
        {hasHeader && (
          <WidgetHeader
            className="border-b px-3 pb-2 pt-3"
            title={title}
            description={description}
          />
        )}
        <div className="flex min-h-0 flex-1 flex-col">
          {tableName ? (
            <LoadedTableView
              tableName={tableName}
              pageSize={widget.config.pageSize}
              experimentId={experimentId}
              selectedColumns={widget.config.columns}
              widgetFilters={widget.config.filters}
            />
          ) : (
            <WidgetEmptyState
              icon={Table2}
              title={t("widget.emptyTable")}
              description={t("widget.emptyTableDescription")}
            />
          )}
        </div>
      </div>
    </ExpandableWidget>
  );
}
