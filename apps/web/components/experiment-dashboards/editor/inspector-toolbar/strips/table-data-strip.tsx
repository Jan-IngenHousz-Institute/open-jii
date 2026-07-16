"use client";

import { useColumnMetadata } from "@/hooks/experiment/useColumnMetadata/useColumnMetadata";
import { useExperimentTables } from "@/hooks/experiment/useExperimentTables/useExperimentTables";
import { Columns3, Database, Filter as FilterIcon } from "lucide-react";
import { useFormContext } from "react-hook-form";

import type { ExperimentTableWidget } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";
import { useTranslation } from "@repo/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { FilterChipBar } from "../../../../data-filters/filter-chip-bar";
import type { DashboardFormValues } from "../../../dashboard-form-shell";
import { ColumnPicker } from "../../column-picker/column-picker";
import type { StripOverflowItem } from "../strip-overflow-list";
import { StripOverflowList } from "../strip-overflow-list";
import { StripPopoverControl } from "../strip-popover-control";

interface TableDataStripProps {
  widget: ExperimentTableWidget;
  widgetIndex: number;
  experimentId: string;
}

// Table-widget Data section: table source, columns (multi-select), filters
// (chip list). Items spill into "More" when the row runs out of width.
export function TableDataStrip({ widget, widgetIndex, experimentId }: TableDataStripProps) {
  const { t } = useTranslation("experimentDashboards");
  const form = useFormContext<DashboardFormValues>();

  const tableName = widget.config.tableName;
  const { tables, isLoading: isLoadingTables } = useExperimentTables(experimentId);
  const tableList = tables ?? [];
  const { columns: availableColumns, isLoading: isLoadingColumns } = useColumnMetadata(
    experimentId,
    tableName,
  );

  const setConfig = (next: Partial<ExperimentTableWidget["config"]>) => {
    form.setValue(
      `widgets.${widgetIndex}.config`,
      { ...widget.config, ...next },
      { shouldDirty: true },
    );
  };

  const handleTableChange = (value: string) => {
    setConfig({ tableName: value, columns: undefined });
  };

  const handleFiltersChange = (next: ExperimentTableWidget["config"]["filters"]) => {
    setConfig({ filters: next && next.length > 0 ? next : undefined });
  };

  // Store undefined for the "all columns" sentinel so new schema columns auto-appear.
  const handleColumnsChange = (next: string[]) => {
    const allColumnNames = availableColumns.map((c) => c.name);
    const sameAsAll =
      next.length === allColumnNames.length && next.every((c, i) => c === allColumnNames[i]);
    setConfig({ columns: sameAsAll ? undefined : next });
  };

  const tableLabel = tableList.find((tbl) => tbl.identifier === tableName)?.displayName;
  const columnsSummary = widget.config.columns
    ? `${widget.config.columns.length}`
    : t("editor.tableConfig.allColumns");
  const filtersSummary = widget.config.filters?.length
    ? String(widget.config.filters.length)
    : undefined;

  const items: StripOverflowItem[] = [
    {
      key: "table",
      node: (
        <StripPopoverControl
          label={t("editor.tableConfig.pickTable")}
          summary={tableLabel}
          icon={Database}
        >
          <Select
            value={tableName ?? ""}
            onValueChange={handleTableChange}
            disabled={isLoadingTables || tableList.length === 0}
          >
            <SelectTrigger className="h-8 w-full">
              <SelectValue placeholder={t("editor.tableConfig.pickTable")} />
            </SelectTrigger>
            <SelectContent>
              {tableList.map((tbl) => (
                <SelectItem key={tbl.identifier} value={tbl.identifier}>
                  {tbl.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </StripPopoverControl>
      ),
    },
    ...(tableName
      ? ([
          {
            key: "columns",
            node: (
              <StripPopoverControl
                label={t("editor.tableConfig.columns")}
                summary={columnsSummary}
                icon={Columns3}
                contentClassName="w-80"
              >
                <div className="bg-muted/30 max-h-64 overflow-y-auto rounded-md p-2">
                  <ColumnPicker
                    available={availableColumns}
                    isLoading={isLoadingColumns}
                    value={widget.config.columns}
                    onChange={handleColumnsChange}
                  />
                </div>
              </StripPopoverControl>
            ),
          },
          {
            key: "filters",
            node: (
              <StripPopoverControl
                label={t("editor.tableConfig.filters")}
                summary={filtersSummary}
                icon={FilterIcon}
                contentClassName="w-96"
              >
                <div className="space-y-2">
                  <FilterChipBar
                    value={widget.config.filters ?? []}
                    onChange={handleFiltersChange}
                    columns={availableColumns}
                    experimentId={experimentId}
                    tableName={tableName}
                  />
                  <p className="text-muted-foreground text-[10px]">
                    {t("editor.tableConfig.filtersHint")}
                  </p>
                </div>
              </StripPopoverControl>
            ),
          },
        ] satisfies StripOverflowItem[])
      : []),
  ];

  return <StripOverflowList items={items} />;
}
