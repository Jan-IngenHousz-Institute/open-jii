import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { lineChartType } from "../../../experiment-visualizations/charts/basic/line";
import type { ChartFormValues } from "../../../experiment-visualizations/charts/chart-config";
import { LiveVizProvider, useLiveViz, useLiveVizPublisher } from "./live-viz-context";

const wrapper = ({ children }: { children: ReactNode }) => (
  <LiveVizProvider>{children}</LiveVizProvider>
);

function makeValues(): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: lineChartType.family,
    chartType: lineChartType.type,
    config: lineChartType.defaultConfig(),
    dataConfig: lineChartType.defaultDataConfig(),
  };
}

describe("LiveVizContext", () => {
  it("returns null from useLiveViz before any publish", () => {
    const { result } = renderHook(() => useLiveViz(), { wrapper });
    expect(result.current).toBeNull();
  });

  it("publish surfaces the latest values to subscribers", () => {
    const { result } = renderHook(() => ({ live: useLiveViz(), publish: useLiveVizPublisher() }), {
      wrapper,
    });

    const values = makeValues();
    act(() => result.current.publish({ vizId: "viz-1", values }));
    expect(result.current.live).toEqual({ vizId: "viz-1", values });
  });

  it("publishing null clears the live state again", () => {
    const { result } = renderHook(() => ({ live: useLiveViz(), publish: useLiveVizPublisher() }), {
      wrapper,
    });

    act(() => result.current.publish({ vizId: "viz-1", values: makeValues() }));
    expect(result.current.live).not.toBeNull();
    act(() => result.current.publish(null));
    expect(result.current.live).toBeNull();
  });

  it("useLiveVizPublisher returns the default no-op publisher outside a provider", () => {
    // Outside the canvas (e.g. standalone viz workspace) the publisher is a
    // shape-stable no-op so callers don't crash.
    const { result } = renderHook(() => useLiveVizPublisher());
    expect(() => result.current({ vizId: "viz-1", values: makeValues() })).not.toThrow();
  });

  it("keeps the publisher reference stable across re-renders", () => {
    const { result, rerender } = renderHook(() => useLiveVizPublisher(), { wrapper });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
