"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import type {
  ExperimentDashboardWidget,
  ExperimentFilterWidget,
} from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";
import type {
  ExperimentDataFilter,
  ExperimentDataFilterValue,
} from "@repo/api/domains/experiment/data/experiment-data.schema";

import { parentColumnName } from "../data-filters/filter-column-path";
import { classifyFilter } from "../data-filters/filter-operators";
import type { FilterIssue } from "../data-filters/filter-operators";

export interface SkippedDashboardFilter {
  widgetId: string;
  label: string;
  reason: FilterIssue;
}

interface DashboardFiltersContextValue {
  getFiltersForTable: (tableName: string) => ExperimentDataFilter[];
  getSkippedFiltersForTable: (tableName: string) => SkippedDashboardFilter[];
  getIssueForWidget: (widgetId: string) => FilterIssue | undefined;
  getValueForWidget: (widgetId: string) => ExperimentDataFilterValue | undefined;
  setValueForWidget: (widgetId: string, value: ExperimentDataFilterValue | undefined) => void;
  isOverridden: (widgetId: string) => boolean;
  resetWidget: (widgetId: string) => void;
}

type OverrideMap = Record<string, ExperimentDataFilterValue | undefined>;

const DashboardFiltersContext = createContext<DashboardFiltersContextValue | null>(null);
const EMPTY_FILTERS: ExperimentDataFilter[] = [];
const EMPTY_SKIPPED: SkippedDashboardFilter[] = [];

interface DashboardFiltersProviderProps {
  widgets: ExperimentDashboardWidget[];
  children: ReactNode;
}

export function DashboardFiltersProvider({ widgets, children }: DashboardFiltersProviderProps) {
  const [overrides, setOverrides] = useState<OverrideMap>({});

  const filterWidgetsById = useFilterWidgetIndex(widgets);

  useGarbageCollectStaleOverrides(filterWidgetsById, setOverrides);

  const getValueForWidget = useCallback(
    (widgetId: string): ExperimentDataFilterValue | undefined => {
      const widget = filterWidgetsById.get(widgetId);
      if (!widget) {
        return undefined;
      }
      return resolveWidgetValue(widget, overrides);
    },
    [filterWidgetsById, overrides],
  );

  const setValueForWidget = useCallback(
    (widgetId: string, value: ExperimentDataFilterValue | undefined) => {
      const widget = filterWidgetsById.get(widgetId);
      if (!widget) {
        return;
      }
      const key = overrideKeyFor(widget);
      setOverrides((prev) => ({ ...prev, [key]: value }));
    },
    [filterWidgetsById],
  );

  const isOverridden = useCallback(
    (widgetId: string) => {
      const widget = filterWidgetsById.get(widgetId);
      if (!widget) {
        return false;
      }
      return overrideKeyFor(widget) in overrides;
    },
    [filterWidgetsById, overrides],
  );

  const resetWidget = useCallback(
    (widgetId: string) => {
      const widget = filterWidgetsById.get(widgetId);
      if (!widget) {
        return;
      }
      const key = overrideKeyFor(widget);
      setOverrides((prev) => dropKey(prev, key));
    },
    [filterWidgetsById],
  );

  // Pre-bucket so per-viz lookups are O(1).
  const { filtersByTable, skippedByTable, issuesByWidget } = useMemo(
    () => buildFilterState(filterWidgetsById, overrides),
    [filterWidgetsById, overrides],
  );

  const value = useMemo<DashboardFiltersContextValue>(
    () => ({
      getFiltersForTable: (tableName) => filtersByTable.get(tableName) ?? EMPTY_FILTERS,
      getSkippedFiltersForTable: (tableName) => skippedByTable.get(tableName) ?? EMPTY_SKIPPED,
      getIssueForWidget: (widgetId) => issuesByWidget.get(widgetId),
      getValueForWidget,
      setValueForWidget,
      isOverridden,
      resetWidget,
    }),
    [
      filtersByTable,
      skippedByTable,
      issuesByWidget,
      getValueForWidget,
      setValueForWidget,
      isOverridden,
      resetWidget,
    ],
  );

  return (
    <DashboardFiltersContext.Provider value={value}>{children}</DashboardFiltersContext.Provider>
  );
}

/** AND-merged filters for a table; empty outside a dashboard so viz pages work. */
export function useDashboardFiltersForTable(tableName: string | undefined): ExperimentDataFilter[] {
  const ctx = useContext(DashboardFiltersContext);
  if (!ctx || !tableName) {
    return EMPTY_FILTERS;
  }
  return ctx.getFiltersForTable(tableName);
}

/** Filter widgets on a table whose value is invalid, so their filter was left out. */
export function useDashboardSkippedFiltersForTable(
  tableName: string | undefined,
): SkippedDashboardFilter[] {
  const ctx = useContext(DashboardFiltersContext);
  if (!ctx || !tableName) {
    return EMPTY_SKIPPED;
  }
  return ctx.getSkippedFiltersForTable(tableName);
}

const EMPTY_RESOLVER = (): ExperimentDataFilter[] => EMPTY_FILTERS;

/**
 * Table to AND-merged filters, for callers that plan across many tables. A new
 * function only when a filter widget's config or value changes.
 */
export function useDashboardFilterResolver(): (tableName: string) => ExperimentDataFilter[] {
  const ctx = useContext(DashboardFiltersContext);
  return ctx?.getFiltersForTable ?? EMPTY_RESOLVER;
}

export function useDashboardFilterWidget(widgetId: string) {
  const ctx = useContext(DashboardFiltersContext);
  if (!ctx) {
    throw new Error("useDashboardFilterWidget must be used inside a DashboardFiltersProvider");
  }
  return {
    value: ctx.getValueForWidget(widgetId),
    setValue: (next: ExperimentDataFilterValue | undefined) =>
      ctx.setValueForWidget(widgetId, next),
    isOverridden: ctx.isOverridden(widgetId),
    issue: ctx.getIssueForWidget(widgetId),
    reset: () => ctx.resetWidget(widgetId),
  };
}

// Override cache keyed by (id, column, operator) so column/operator swaps invalidate.
function overrideKeyFor(widget: ExperimentFilterWidget): string {
  return `${widget.id}:${widget.config.column ?? ""}:${widget.config.operator ?? ""}`;
}

function indexFilterWidgets(
  widgets: ExperimentDashboardWidget[],
): Map<string, ExperimentFilterWidget> {
  const map = new Map<string, ExperimentFilterWidget>();
  for (const widget of widgets) {
    if (widget.type === "filter") {
      map.set(widget.id, widget);
    }
  }
  return map;
}

/**
 * Index keyed on filter-widget CONTENT, not `widgets` identity. The editor
 * form emits a fresh widgets array on every keystroke in any widget (e.g.
 * rich-text html); an identity-keyed memo would rebuild the index, churn the
 * context value, and re-render every chart on the dashboard per input.
 */
function useFilterWidgetIndex(
  widgets: ExperimentDashboardWidget[],
): Map<string, ExperimentFilterWidget> {
  const filterWidgets = widgets.filter((widget) => widget.type === "filter");
  const signature = JSON.stringify(filterWidgets);

  const indexRef = useRef<{ signature: string; map: Map<string, ExperimentFilterWidget> } | null>(
    null,
  );
  if (indexRef.current?.signature !== signature) {
    indexRef.current = { signature, map: indexFilterWidgets(filterWidgets) };
  }
  return indexRef.current.map;
}

function resolveWidgetValue(
  widget: ExperimentFilterWidget,
  overrides: OverrideMap,
): ExperimentDataFilterValue | undefined {
  const key = overrideKeyFor(widget);
  if (key in overrides) {
    return overrides[key];
  }
  return widget.config.defaultValue;
}

function dropKey(map: OverrideMap, key: string): OverrideMap {
  if (!(key in map)) {
    return map;
  }
  const next = { ...map };
  delete next[key];
  return next;
}

interface FilterState {
  filtersByTable: Map<string, ExperimentDataFilter[]>;
  skippedByTable: Map<string, SkippedDashboardFilter[]>;
  issuesByWidget: Map<string, FilterIssue>;
}

function buildFilterState(
  filterWidgetsById: Map<string, ExperimentFilterWidget>,
  overrides: OverrideMap,
): FilterState {
  const state: FilterState = {
    filtersByTable: new Map(),
    skippedByTable: new Map(),
    issuesByWidget: new Map(),
  };
  for (const widget of filterWidgetsById.values()) {
    const { tableName, column, operator } = widget.config;
    if (!tableName || !column || !operator) {
      continue;
    }
    const value = resolveWidgetValue(widget, overrides);
    const result = classifyFilter({ column, operator, value });
    if (result.status === "applied") {
      appendTo(state.filtersByTable, tableName, result.filter);
    } else if (result.status === "invalid") {
      appendTo(state.skippedByTable, tableName, {
        widgetId: widget.id,
        label: widget.config.title ?? parentColumnName(column),
        reason: result.reason,
      });
      state.issuesByWidget.set(widget.id, result.reason);
    }
  }
  return state;
}

function appendTo<T>(map: Map<string, T[]>, key: string, item: T) {
  map.set(key, [...(map.get(key) ?? []), item]);
}

/** Drops overrides whose widget was removed or whose column/operator changed. */
function useGarbageCollectStaleOverrides(
  filterWidgetsById: Map<string, ExperimentFilterWidget>,
  setOverrides: (updater: (prev: OverrideMap) => OverrideMap) => void,
) {
  const validKeysSignature = useMemo(
    () => Array.from(filterWidgetsById.values()).map(overrideKeyFor).sort().join("|"),
    [filterWidgetsById],
  );
  const previousSignatureRef = useRef(validKeysSignature);

  useEffect(() => {
    if (previousSignatureRef.current === validKeysSignature) {
      return;
    }
    previousSignatureRef.current = validKeysSignature;

    setOverrides((prev) => pruneOverrides(prev, filterWidgetsById));
  }, [validKeysSignature, filterWidgetsById, setOverrides]);
}

function pruneOverrides(
  prev: OverrideMap,
  filterWidgetsById: Map<string, ExperimentFilterWidget>,
): OverrideMap {
  const validKeys = new Set(Array.from(filterWidgetsById.values()).map(overrideKeyFor));
  const next: OverrideMap = {};
  let changed = false;
  for (const [key, value] of Object.entries(prev)) {
    if (validKeys.has(key)) {
      next[key] = value;
    } else {
      changed = true;
    }
  }
  return changed ? next : prev;
}
