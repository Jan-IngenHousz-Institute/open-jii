"use client";

import { useColumnMetadata } from "@/hooks/experiment/useColumnMetadata/useColumnMetadata";
import { useExperimentTables } from "@/hooks/experiment/useExperimentTables/useExperimentTables";
import { Columns3, Database, Filter as FilterIcon } from "lucide-react";
import { useFormContext } from "react-hook-form";

import type { FilterWidget } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { filterColumnPathFor, parentColumnName } from "../../../../data-filters/filter-column-path";
import {
  defaultOperatorForColumn,
  operatorsForColumn,
} from "../../../../data-filters/filter-operators";
import type { DashboardFormValues } from "../../../dashboard-form-shell";
import type { StripOverflowItem } from "../strip-overflow-list";
import { StripOverflowList } from "../strip-overflow-list";
import { StripPopoverControl } from "../strip-popover-control";

interface FilterDataStripProps {
  widget: FilterWidget;
  widgetIndex: number;
  experimentId: string;
}

// Filter-widget Data section: one popover per setting (table / column /
// operator); spills into "More" once the row runs out of width.
export function FilterDataStrip({ widget, widgetIndex, experimentId }: FilterDataStripProps) {
  const { t } = useTranslation("experimentDashboards");
  const form = useFormContext<DashboardFormValues>();

  const tableName = widget.config.tableName;
  const columnName = widget.config.column;
  const operator = widget.config.operator;
  const pickedColumnName = columnName ? parentColumnName(columnName) : undefined;

  const { tables, isLoading: isLoadingTables } = useExperimentTables(experimentId);
  const tableList = tables ?? [];
  const { columns, isLoading: isLoadingColumns } = useColumnMetadata(experimentId, tableName);
  const pickedColumn = columns.find((c) => c.name === pickedColumnName);
  const operatorOptions = operatorsForColumn(pickedColumn);

  const setConfig = (next: Partial<FilterWidget["config"]>) => {
    form.setValue(
      `widgets.${widgetIndex}.config`,
      { ...widget.config, ...next },
      { shouldDirty: true },
    );
  };

  const handleTableChange = (value: string) => {
    setConfig({
      tableName: value,
      column: undefined,
      operator: undefined,
      defaultValue: undefined,
    });
  };

  const handleColumnChange = (value: string) => {
    const next = columns.find((c) => c.name === value);
    const allowed = operatorsForColumn(next).map((o) => o.value);
    const preferred = defaultOperatorForColumn(next);
    const nextOperator = allowed.includes(preferred) ? preferred : allowed[0];
    const nextPath = next ? filterColumnPathFor(next) : value;
    setConfig({ column: nextPath, operator: nextOperator, defaultValue: undefined });
  };

  const handleOperatorChange = (value: string) => {
    const picked = operatorOptions.find((op) => op.value === value);
    if (picked) {
      setConfig({ operator: picked.value, defaultValue: undefined });
    }
  };

  const tableLabel = tableList.find((tbl) => tbl.identifier === tableName)?.displayName;

  const items: StripOverflowItem[] = [
    {
      key: "table",
      node: (
        <StripPopoverControl
          label={t("editor.filterConfig.pickTable")}
          summary={tableLabel}
          icon={Database}
        >
          <Select
            value={tableName ?? ""}
            onValueChange={handleTableChange}
            disabled={isLoadingTables || tableList.length === 0}
          >
            <SelectTrigger className="h-8 w-full">
              <SelectValue placeholder={t("editor.filterConfig.pickTable")} />
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
      ? [
          {
            key: "column",
            node: (
              <StripPopoverControl
                label={t("editor.filterConfig.pickColumn")}
                summary={pickedColumnName}
                icon={Columns3}
              >
                <Select
                  value={pickedColumnName ?? ""}
                  onValueChange={handleColumnChange}
                  disabled={isLoadingColumns || columns.length === 0}
                >
                  <SelectTrigger className="h-8 w-full">
                    <SelectValue
                      placeholder={
                        isLoadingColumns
                          ? t("ui.messages.loading")
                          : t("editor.filterConfig.pickColumn")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((col) => (
                      <SelectItem key={col.name} value={col.name}>
                        {col.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </StripPopoverControl>
            ),
          } satisfies StripOverflowItem,
        ]
      : []),
    ...(pickedColumn && operatorOptions.length > 0
      ? [
          {
            key: "operator",
            node: (
              <StripPopoverControl
                label={t("editor.filterConfig.pickOperator")}
                summary={operatorOptions.find((o) => o.value === operator)?.label}
                icon={FilterIcon}
              >
                <Select value={operator ?? ""} onValueChange={handleOperatorChange}>
                  <SelectTrigger className="h-8 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {operatorOptions.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </StripPopoverControl>
            ),
          } satisfies StripOverflowItem,
        ]
      : []),
  ];

  return <StripOverflowList items={items} />;
}
