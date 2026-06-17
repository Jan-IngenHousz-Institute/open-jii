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
  DashboardWidget,
  DataFilter,
  DataFilterValue,
  FilterWidget,
} from "@repo/api/schemas/experiment.schema";
import { zDataFilter } from "@repo/api/schemas/experiment.schema";

interface DashboardFiltersContextValue {
  getFiltersForTable: (tableName: string) => DataFilter[];
  getValueForWidget: (widgetId: string) => DataFilterValue | undefined;
  setValueForWidget: (widgetId: string, value: DataFilterValue | undefined) => void;
  isOverridden: (widgetId: string) => boolean;
  resetWidget: (widgetId: string) => void;
}

type OverrideMap = Record<string, DataFilterValue | undefined>;

const DashboardFiltersContext = createContext<DashboardFiltersContextValue | null>(null);
const EMPTY_FILTERS: DataFilter[] = [];

interface DashboardFiltersProviderProps {
  widgets: DashboardWidget[];
  children: ReactNode;
}

export function DashboardFiltersProvider({ widgets, children }: DashboardFiltersProviderProps) {
  const [overrides, setOverrides] = useState<OverrideMap>({});

  const filterWidgetsById = useMemo(() => indexFilterWidgets(widgets), [widgets]);

  useGarbageCollectStaleOverrides(filterWidgetsById, setOverrides);

  const getValueForWidget = useCallback(
    (widgetId: string): DataFilterValue | undefined => {
      const widget = filterWidgetsById.get(widgetId);
      if (!widget) {
        return undefined;
      }
      return resolveWidgetValue(widget, overrides);
    },
    [filterWidgetsById, overrides],
  );

  const setValueForWidget = useCallback(
    (widgetId: string, value: DataFilterValue | undefined) => {
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
export function useDashboardFiltersForTable(tableName: string | undefined): DataFilter[] {
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
    setValue: (next: DataFilterValue | undefined) => ctx.setValueForWidget(widgetId, next),
    isOverridden: ctx.isOverridden(widgetId),
    reset: () => ctx.resetWidget(widgetId),
  };
}

// Override cache keyed by (id, column, operator) so column/operator swaps invalidate.
function overrideKeyFor(widget: FilterWidget): string {
  return `${widget.id}:${widget.config.column ?? ""}:${widget.config.operator ?? ""}`;
}

function indexFilterWidgets(widgets: DashboardWidget[]): Map<string, FilterWidget> {
  const map = new Map<string, FilterWidget>();
  for (const widget of widgets) {
    if (widget.type === "filter") {
      map.set(widget.id, widget);
    }
  }
  return map;
}

function resolveWidgetValue(
  widget: FilterWidget,
  overrides: OverrideMap,
): DataFilterValue | undefined {
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
  filterWidgetsById: Map<string, FilterWidget>,
  overrides: OverrideMap,
): Map<string, DataFilter[]> {
  const map = new Map<string, DataFilter[]>();
  for (const widget of filterWidgetsById.values()) {
    const { tableName, column, operator } = widget.config;
    if (!tableName || !column || !operator) {
      continue;
    }
    const value = resolveWidgetValue(widget, overrides);
    if (value === undefined) {
      continue;
    }
    const candidate: DataFilter = { column, operator, value };
    if (!zDataFilter.safeParse(candidate).success) {
      continue;
    }
    const existing = map.get(tableName) ?? [];
    map.set(tableName, [...existing, candidate]);
  }
  return map;
}

/** Drops overrides whose widget was removed or whose column/operator changed. */
function useGarbageCollectStaleOverrides(
  filterWidgetsById: Map<string, FilterWidget>,
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
  filterWidgetsById: Map<string, FilterWidget>,
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
