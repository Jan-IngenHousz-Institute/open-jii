"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo, useRef } from "react";
import type { ReactNode } from "react";

import type { ExperimentDashboardWidget } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";
import type {
  ExperimentDataAggregation,
  ExperimentDataFilter,
} from "@repo/api/domains/experiment/data/experiment-data.schema";
import type {
  ExperimentChartDataConfig,
  ExperimentVisualization,
} from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";

import { experimentVisualizationIndexOptions } from "../../hooks/experiment/useExperimentVisualizationIndex/useExperimentVisualizationIndex";
import { readColumnsOf } from "../experiment-visualizations/charts/data/data-sources";
import { useDashboardFilterResolver } from "./dashboard-filters-context";

/** One request serving every visualization on a table with the same filters. */
export interface SharedRead {
  tableName: string;
  columns: string[];
  filters: ExperimentDataFilter[] | undefined;
  orderBy: string | undefined;
}

/** What one chart would read on its own. */
export interface OwnRead {
  tableName: string;
  columns: string[];
  filters: ExperimentDataFilter[] | undefined;
  aggregation: ExperimentDataAggregation | undefined;
}

type FilterResolver = (tableName: string) => ExperimentDataFilter[];

interface GroupMember {
  id: string;
  columns: string[];
  x: string | undefined;
}

interface ReadGroup {
  tableName: string;
  filters: ExperimentDataFilter[] | undefined;
  members: GroupMember[];
}

const DashboardSharedReadsContext = createContext<Map<string, SharedRead> | null>(null);
const NO_PLANS = new Map<string, SharedRead>();

interface DashboardSharedReadsProviderProps {
  experimentId: string;
  widgets: ExperimentDashboardWidget[];
  children: ReactNode;
}

/**
 * Plans one read per (table, filters) group across the dashboard's
 * visualization widgets, from the visualization index the widgets already
 * load. Charts then share a query key instead of each fetching their own
 * projection of the same rows.
 */
export function DashboardSharedReadsProvider({
  experimentId,
  widgets,
  children,
}: DashboardSharedReadsProviderProps) {
  // Subscribe only: the first widget to come into view fetches the index, and
  // a dashboard nobody scrolls issues no request at all.
  const { data: index } = useQuery({
    ...experimentVisualizationIndexOptions(experimentId),
    enabled: false,
  });
  const filtersFor = useDashboardFilterResolver();
  const visualizationIds = useVisualizationIds(widgets);

  const plans = useMemo(
    () => (index ? planSharedReads(index, visualizationIds, filtersFor) : NO_PLANS),
    [index, visualizationIds, filtersFor],
  );

  return (
    <DashboardSharedReadsContext.Provider value={plans}>
      {children}
    </DashboardSharedReadsContext.Provider>
  );
}

/**
 * The shared read covering a chart's own read, or undefined when the chart is
 * outside a dashboard, alone on its table, or would read something the plan
 * does not carry. Any mismatch means the chart fetches alone.
 */
export function useDashboardSharedRead(
  visualizationId: string,
  own: OwnRead,
): SharedRead | undefined {
  const plans = useContext(DashboardSharedReadsContext);
  const plan = plans?.get(visualizationId);
  if (!plan) {
    return undefined;
  }
  return covers(plan, own) ? plan : undefined;
}

/** True when the aggregation would change the row set, the data hook's own rule. */
export function isAggregationActive(aggregation: ExperimentDataAggregation | undefined): boolean {
  const groupBy = (aggregation?.groupBy ?? []).filter((item) => item.column.length > 0);
  const functions = (aggregation?.functions ?? []).filter((item) => item.column.length > 0);
  return groupBy.length > 0 || functions.length > 0;
}

/**
 * Keyed on widget CONTENT, not array identity: the editor form emits a fresh
 * widgets array on every keystroke in any widget.
 */
function useVisualizationIds(widgets: ExperimentDashboardWidget[]): string[] {
  const ids = Array.from(
    new Set(
      widgets.flatMap((widget) =>
        widget.type === "visualization" && widget.config.visualizationId
          ? [widget.config.visualizationId]
          : [],
      ),
    ),
  ).sort();
  const signature = ids.join("|");

  const ref = useRef<{ signature: string; ids: string[] } | null>(null);
  if (ref.current?.signature !== signature) {
    ref.current = { signature, ids };
  }
  return ref.current.ids;
}

function planSharedReads(
  index: ExperimentVisualization[],
  visualizationIds: string[],
  filtersFor: FilterResolver,
): Map<string, SharedRead> {
  const byId = new Map(index.map((visualization) => [visualization.id, visualization]));
  const groups = new Map<string, ReadGroup>();

  for (const id of visualizationIds) {
    const visualization = byId.get(id);
    if (!visualization) {
      continue;
    }
    const member = memberOf(id, visualization.dataConfig, filtersFor);
    if (!member) {
      continue;
    }
    const key = `${member.tableName}\n${JSON.stringify(member.filters ?? [])}`;
    const group = groups.get(key) ?? {
      tableName: member.tableName,
      filters: member.filters,
      members: [],
    };
    group.members.push(member);
    groups.set(key, group);
  }

  const plans = new Map<string, SharedRead>();
  for (const group of groups.values()) {
    // A group of one gains nothing and would only change that chart's key.
    if (group.members.length < 2) {
      continue;
    }
    const plan: SharedRead = {
      tableName: group.tableName,
      columns: Array.from(new Set(group.members.flatMap((member) => member.columns))).sort(),
      filters: group.filters,
      orderBy: commonestX(group.members),
    };
    for (const member of group.members) {
      plans.set(member.id, plan);
    }
  }
  return plans;
}

function memberOf(
  id: string,
  dataConfig: ExperimentChartDataConfig,
  filtersFor: FilterResolver,
): (GroupMember & Pick<ReadGroup, "tableName" | "filters">) | undefined {
  if (!dataConfig.tableName || isAggregationActive(dataConfig.aggregation)) {
    return undefined;
  }
  const columns = readColumnsOf(dataConfig.dataSources);
  if (columns.length === 0) {
    return undefined;
  }
  const dashboardFilters = filtersFor(dataConfig.tableName);
  const filters =
    dashboardFilters.length > 0
      ? [...(dataConfig.filters ?? []), ...dashboardFilters]
      : dataConfig.filters;
  const x = dataConfig.dataSources.find(
    (source) => source.role === "x" && source.columnName.length > 0,
  )?.columnName;
  return { id, tableName: dataConfig.tableName, filters, columns, x };
}

function commonestX(members: GroupMember[]): string | undefined {
  const counts = new Map<string, number>();
  for (const member of members) {
    if (member.x !== undefined) {
      counts.set(member.x, (counts.get(member.x) ?? 0) + 1);
    }
  }
  let best: string | undefined;
  let bestCount = 0;
  for (const [column, count] of counts) {
    if (count > bestCount) {
      best = column;
      bestCount = count;
    }
  }
  return best;
}

function covers(plan: SharedRead, own: OwnRead): boolean {
  if (plan.tableName !== own.tableName || isAggregationActive(own.aggregation)) {
    return false;
  }
  if (JSON.stringify(plan.filters ?? []) !== JSON.stringify(own.filters ?? [])) {
    return false;
  }
  const available = new Set(plan.columns);
  return own.columns.every((column) => available.has(column));
}
