"use client";

import { AlertCircle, Columns3, Database, Filter as FilterIcon, Loader2 } from "lucide-react";
import { useEffect } from "react";
import type { ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { ExperimentTableMetadata } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { useTranslation } from "@repo/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import type { ChartFormValues } from "../../../../experiment-visualizations/charts/chart-config";
import { getChartTypeDef } from "../../../../experiment-visualizations/charts/chart-registry";
import type { ShelfDef } from "../../../../experiment-visualizations/charts/types";
import { FiltersShelf } from "../../../../experiment-visualizations/workspace/shelves/filters-shelf";
import { useDashboardEditor } from "../../context/dashboard-editor-context";
import type { StripOverflowItem } from "../strip-overflow-list";
import { StripOverflowList } from "../strip-overflow-list";
import { StripPopoverControl } from "../strip-popover-control";

interface VisualizationDataStripProps {
  form: UseFormReturn<ChartFormValues>;
  experimentId: string;
  tables: ExperimentTableMetadata[];
  isTablesLoading: boolean;
  tablesError: unknown;
  selectedTableName: string;
  onTableChange: (tableName: string) => void;
  columns: ExperimentDataColumn[];
  isColumnsLoading: boolean;
  columnsError: unknown;
}

// Viz-widget Data section: Dataset + per-shelf popovers + Filters, all
// spilling into a measured "More" popover when width runs out.
export function VisualizationDataStrip({
  form,
  experimentId,
  tables,
  isTablesLoading,
  tablesError,
  selectedTableName,
  onTableChange,
  columns,
  isColumnsLoading,
  columnsError,
}: VisualizationDataStripProps) {
  const { t } = useTranslation("experimentDashboards");
  const { t: tViz } = useTranslation("experimentVisualizations");

  const chartType = useWatch({ control: form.control, name: "chartType" });
  const def = getChartTypeDef(chartType);

  // Broad subscription so shelf `visible(form)` predicates re-evaluate
  // whenever the user changes data sources / trace types.
  useWatch({ control: form.control, name: "dataConfig.dataSources" });

  const tableLabel = tables.find((tbl) => tbl.identifier === selectedTableName)?.displayName;
  const hasTable = Boolean(selectedTableName);
  const hasColumns = columns.length > 0;
  const filters = useWatch({ control: form.control, name: "dataConfig.filters" }) ?? [];
  const filtersSummary = filters.length > 0 ? String(filters.length) : undefined;

  // Dataset popover open state lives in the editor context so the inline
  // viz-create flow can request it open before this strip mounts. Reset on
  // unmount so the open flag doesn't leak past a section / widget switch.
  const { datasetOpen, setDatasetOpen } = useDashboardEditor();
  useEffect(
    () => () => {
      setDatasetOpen(false);
    },
    [setDatasetOpen],
  );

  const datasetItem: StripOverflowItem = {
    key: "dataset",
    node: (
      <StripPopoverControl
        label={t("editor.vizDataStrip.dataset")}
        summary={tableLabel}
        icon={Database}
        open={datasetOpen}
        onOpenChange={setDatasetOpen}
      >
        <Select
          value={selectedTableName || undefined}
          onValueChange={onTableChange}
          disabled={isTablesLoading || tables.length === 0}
        >
          <SelectTrigger className="h-8 w-full gap-1.5">
            {isTablesLoading && <Loader2 className="text-muted-foreground size-3 animate-spin" />}
            <SelectValue
              placeholder={
                isTablesLoading
                  ? tViz("workspace.inspector.loadingTables")
                  : tables.length === 0
                    ? tViz("workspace.inspector.noTables")
                    : tViz("workspace.inspector.selectTable")
              }
            />
          </SelectTrigger>
          <SelectContent>
            {tablesError ? (
              <div className="text-destructive px-2 py-1.5 text-xs">
                {tViz("workspace.inspector.failedToLoadTables")}
              </div>
            ) : tables.length === 0 ? (
              <div className="text-muted-foreground px-2 py-1.5 text-xs">
                {tViz("workspace.inspector.noTables")}
              </div>
            ) : (
              tables.map((tbl) => (
                <SelectItem key={tbl.identifier} value={tbl.identifier}>
                  {tbl.displayName}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </StripPopoverControl>
    ),
  };

  const fieldItems = buildFieldItems({
    form,
    columns,
    hasTable,
    hasColumns,
    isColumnsLoading,
    columnsError,
    shelves: def.dataShelves,
    fallbackPanel: def.DataPanel,
    unsupported: false,
    tViz,
    tDash: t,
  });

  const filtersItem: StripOverflowItem | null =
    hasTable && hasColumns
      ? {
          key: "filters",
          node: (
            <StripPopoverControl
              label={tViz("workspace.shelves.filters")}
              summary={filtersSummary}
              icon={FilterIcon}
              contentClassName="w-96"
            >
              <FiltersShelf
                form={form}
                columns={columns}
                experimentId={experimentId}
                tableName={selectedTableName}
                flat
              />
            </StripPopoverControl>
          ),
        }
      : null;

  const items: StripOverflowItem[] = [
    datasetItem,
    ...fieldItems,
    ...(filtersItem ? [filtersItem] : []),
  ];

  return <StripOverflowList items={items} />;
}

interface BuildFieldItemsArgs {
  form: UseFormReturn<ChartFormValues>;
  columns: ExperimentDataColumn[];
  hasTable: boolean;
  hasColumns: boolean;
  isColumnsLoading: boolean;
  columnsError: unknown;
  shelves: ShelfDef[] | undefined;
  fallbackPanel: NonNullable<ReturnType<typeof getChartTypeDef>>["DataPanel"] | undefined;
  unsupported: boolean;
  tViz: (key: string) => string;
  tDash: (key: string) => string;
}

function buildFieldItems(args: BuildFieldItemsArgs): StripOverflowItem[] {
  const {
    form,
    columns,
    hasTable,
    hasColumns,
    isColumnsLoading,
    columnsError,
    shelves,
    fallbackPanel: FallbackPanel,
    unsupported,
    tViz,
    tDash,
  } = args;

  const fieldsLabel = tDash("editor.vizDataStrip.fields");
  const renderFallback = (body: ReactNode): StripOverflowItem[] => [
    {
      key: "fields",
      node: (
        <StripPopoverControl label={fieldsLabel} icon={Columns3} contentClassName="w-96">
          {body}
        </StripPopoverControl>
      ),
    },
  ];

  // States where shelves can't render: no table, schema fetch failed,
  // unsupported chart type. Column-loading falls through so the toolbar
  // doesn't blink between renders.
  if (!hasTable) {
    return renderFallback(<NoticeBox text={tViz("workspace.inspector.selectTableFirst")} />);
  }
  if (columnsError) {
    return renderFallback(
      <NoticeBox icon text={tViz("workspace.inspector.failedToLoadColumns")} />,
    );
  }
  if (unsupported) {
    return renderFallback(<NoticeBox text={tViz("errors.chartTypeNotSupported")} />);
  }

  // Per-shelf items when the chart type opted in. Loading/zero-columns
  // states fall through so the trigger summaries (already-picked columns)
  // stay visible during the loading beat.
  if (shelves && shelves.length > 0) {
    return shelves
      .filter((shelf) => !shelf.visible || shelf.visible(form))
      .map((shelf) => {
        const Comp = shelf.Component;
        return {
          key: shelf.key,
          node: (
            <StripPopoverControl
              label={tViz(shelf.labelKey)}
              icon={shelf.icon}
              summary={shelf.summary?.(form, tViz)}
              contentClassName="w-96"
            >
              <Comp form={form} columns={columns} flat />
            </StripPopoverControl>
          ),
        };
      });
  }

  // Legacy fallback: chart type hasn't declared shelves yet.
  if (isColumnsLoading) {
    return renderFallback(<NoticeBox text={tViz("workspace.inspector.loadingColumns")} />);
  }
  if (!hasColumns) {
    return renderFallback(<NoticeBox icon text={tViz("workspace.inspector.noValidColumns")} />);
  }
  return renderFallback(FallbackPanel ? <FallbackPanel form={form} columns={columns} /> : null);
}

function NoticeBox({ text, icon }: { text: string; icon?: boolean }) {
  return (
    <div className="text-muted-foreground flex items-center gap-2 rounded-md border border-dashed p-3 text-xs">
      {icon && <AlertCircle className="size-3.5 shrink-0" />}
      {text}
    </div>
  );
}
