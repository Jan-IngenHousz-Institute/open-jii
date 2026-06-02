import { createFilterWidget } from "@/test/factories";
import { render, screen, act } from "@/test/test-utils";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import type { DashboardWidget } from "@repo/api/schemas/experiment.schema";

import {
  DashboardFiltersProvider,
  useDashboardFilterWidget,
  useDashboardFiltersForTable,
} from "./dashboard-filters-context";

function wrapWithWidgets(widgets: DashboardWidget[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <DashboardFiltersProvider widgets={widgets}>{children}</DashboardFiltersProvider>;
  };
}

describe("useDashboardFiltersForTable", () => {
  it("returns an empty array without a provider so standalone viz pages still work", () => {
    function Probe() {
      const filters = useDashboardFiltersForTable("raw_data");
      return <span data-testid="count">{filters.length}</span>;
    }
    render(<Probe />);
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  it("returns an empty array when no filter widgets target the table", () => {
    const widgets = [
      createFilterWidget({
        config: {
          tableName: "device",
          column: "device_id",
          operator: "equals",
          defaultValue: "D1",
        },
      }),
    ];
    function Probe() {
      const filters = useDashboardFiltersForTable("raw_data");
      return <span data-testid="count">{filters.length}</span>;
    }
    render(
      <DashboardFiltersProvider widgets={widgets}>
        <Probe />
      </DashboardFiltersProvider>,
    );
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  it("AND-merges each same-table filter widget's saved default", () => {
    const widgets = [
      createFilterWidget({
        config: {
          tableName: "raw_data",
          column: "device_id",
          operator: "equals",
          defaultValue: "D1",
        },
      }),
      createFilterWidget({
        config: {
          tableName: "raw_data",
          column: "temperature",
          operator: "greater_than",
          defaultValue: 20,
        },
      }),
      createFilterWidget({
        // Different table - must NOT bleed into raw_data.
        config: {
          tableName: "device",
          column: "lot",
          operator: "equals",
          defaultValue: "L42",
        },
      }),
    ];
    function Probe() {
      const filters = useDashboardFiltersForTable("raw_data");
      return (
        <ul>
          {filters.map((f, i) => (
            <li key={i} data-testid={`f-${i}`}>{`${f.column}|${f.operator}|${String(f.value)}`}</li>
          ))}
        </ul>
      );
    }
    render(
      <DashboardFiltersProvider widgets={widgets}>
        <Probe />
      </DashboardFiltersProvider>,
    );
    expect(screen.getByTestId("f-0")).toHaveTextContent("device_id|equals|D1");
    expect(screen.getByTestId("f-1")).toHaveTextContent("temperature|greater_than|20");
  });

  it("drops widgets with incomplete config (no column / operator / value)", () => {
    const widgets = [
      createFilterWidget({ config: { tableName: "raw_data" } }),
      createFilterWidget({
        config: { tableName: "raw_data", column: "device_id", operator: "equals" },
      }),
      createFilterWidget({
        config: {
          tableName: "raw_data",
          column: "device_id",
          operator: "equals",
          defaultValue: "",
        },
      }),
    ];
    function Probe() {
      const filters = useDashboardFiltersForTable("raw_data");
      return <span data-testid="count">{filters.length}</span>;
    }
    render(
      <DashboardFiltersProvider widgets={widgets}>
        <Probe />
      </DashboardFiltersProvider>,
    );
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });
});

describe("useDashboardFilterWidget", () => {
  it("throws outside a provider (filter widgets cannot function without one)", () => {
    const originalError = console.error;
    console.error = () => {
      /* swallow React's error log */
    };
    try {
      expect(() => renderHook(() => useDashboardFilterWidget("a"))).toThrow(
        /must be used inside a DashboardFiltersProvider/,
      );
    } finally {
      console.error = originalError;
    }
  });

  it("returns the saved default when no override has been set", () => {
    const widget = createFilterWidget({
      config: {
        tableName: "raw_data",
        column: "device_id",
        operator: "equals",
        defaultValue: "D1",
      },
    });
    const { result } = renderHook(() => useDashboardFilterWidget(widget.id), {
      wrapper: wrapWithWidgets([widget]),
    });
    expect(result.current.value).toBe("D1");
    expect(result.current.isOverridden).toBe(false);
  });

  it("treats overrides as session state without mutating the widget config", () => {
    const widget = createFilterWidget({
      config: {
        tableName: "raw_data",
        column: "device_id",
        operator: "equals",
        defaultValue: "D1",
      },
    });
    const { result } = renderHook(() => useDashboardFilterWidget(widget.id), {
      wrapper: wrapWithWidgets([widget]),
    });

    act(() => {
      result.current.setValue("D9");
    });

    expect(result.current.value).toBe("D9");
    expect(result.current.isOverridden).toBe(true);
    expect(widget.config.defaultValue).toBe("D1");
  });

  it("reset() drops the override and the value falls back to the saved default", () => {
    const widget = createFilterWidget({
      config: {
        tableName: "raw_data",
        column: "device_id",
        operator: "equals",
        defaultValue: "D1",
      },
    });
    const { result } = renderHook(() => useDashboardFilterWidget(widget.id), {
      wrapper: wrapWithWidgets([widget]),
    });

    act(() => {
      result.current.setValue("D9");
    });
    expect(result.current.isOverridden).toBe(true);

    act(() => {
      result.current.reset();
    });
    expect(result.current.value).toBe("D1");
    expect(result.current.isOverridden).toBe(false);
  });

  it("overrides flow into the merged filter set for matching tables", () => {
    const widget = createFilterWidget({
      config: {
        tableName: "raw_data",
        column: "device_id",
        operator: "equals",
        defaultValue: "D1",
      },
    });
    const { result } = renderHook(
      () => ({
        widget: useDashboardFilterWidget(widget.id),
        merged: useDashboardFiltersForTable("raw_data"),
      }),
      { wrapper: wrapWithWidgets([widget]) },
    );

    expect(result.current.merged).toEqual([
      { column: "device_id", operator: "equals", value: "D1" },
    ]);

    act(() => {
      result.current.widget.setValue("D9");
    });

    expect(result.current.merged).toEqual([
      { column: "device_id", operator: "equals", value: "D9" },
    ]);
  });
});
