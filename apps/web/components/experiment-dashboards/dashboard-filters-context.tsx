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
import { zExperimentDataFilter } from "@repo/api/domains/experiment/data/experiment-data.schema";

interface DashboardFiltersContextValue {
  getFiltersForTable: (tableName: string) => ExperimentDataFilter[];
  getValueForWidget: (widgetId: string) => ExperimentDataFilterValue | undefined;
  setValueForWidget: (widgetId: string, value: ExperimentDataFilterValue | undefined) => void;
  isOverridden: (widgetId: string) => boolean;
  resetWidget: (widgetId: string) => void;
}

type OverrideMap = Record<string, ExperimentDataFilterValue | undefined>;

const DashboardFiltersContext = createContext<DashboardFiltersContextValue | null>(null);
const EMPTY_FILTERS: ExperimentDataFilter[] = [];

interface DashboardFiltersProviderProps {
  widgets: ExperimentDashboardWidget[];
  children: ReactNode;
}

export function DashboardFiltersProvider({ widgets, children }: DashboardFiltersProviderProps) {
  const [overrides, setOverrides] = useState<OverrideMap>({});

  const filterWidgetsById = useMemo(() => indexFilterWidgets(widgets), [widgets]);

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
  const filtersByTable = useMemo(
    () => buildFiltersByTable(filterWidgetsById, overrides),
    [filterWidgetsById, overrides],
  );

  const value = useMemo<DashboardFiltersContextValue>(
    () => ({
      getFiltersForTable: (tableName) => filtersByTable.get(tableName) ?? EMPTY_FILTERS,
      getValueForWidget,
      setValueForWidget,
      isOverridden,
      resetWidget,
    }),
    [filtersByTable, getValueForWidget, setValueForWidget, isOverridden, resetWidget],
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

function buildFiltersByTable(
  filterWidgetsById: Map<string, ExperimentFilterWidget>,
  overrides: OverrideMap,
): Map<string, ExperimentDataFilter[]> {
  const map = new Map<string, ExperimentDataFilter[]>();
  for (const widget of filterWidgetsById.values()) {
    const { tableName, column, operator } = widget.config;
    if (!tableName || !column || !operator) {
      continue;
    }
    const value = resolveWidgetValue(widget, overrides);
    if (value === undefined) {
      continue;
    }
    const candidate: ExperimentDataFilter = { column, operator, value };
    if (!zExperimentDataFilter.safeParse(candidate).success) {
      continue;
    }
    const existing = map.get(tableName) ?? [];
    map.set(tableName, [...existing, candidate]);
  }
  return map;
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
