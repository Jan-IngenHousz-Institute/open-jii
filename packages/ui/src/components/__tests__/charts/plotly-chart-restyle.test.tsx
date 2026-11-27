import { render, waitFor } from "@testing-library/react";
import type { PlotRestyleEvent } from "plotly.js";
import { Activity, useEffect, useRef } from "react";
import type { PlotParams } from "react-plotly.js";
import { describe, expect, it, vi } from "vitest";

import { PlotlyChart } from "../../charts/plotly-chart";

const runtime = vi.hoisted(() => ({
  restyle: undefined as ((event: PlotRestyleEvent) => void) | undefined,
  draws: 0,
}));

vi.mock("../../charts/plotly-runtime", () => ({
  Plot: ({ onInitialized, onPurge }: PlotParams) => {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (!ref.current) return;
      const graph = Object.assign(ref.current, {
        on: (name: string, callback: typeof runtime.restyle) => {
          if (name === "plotly_restyle") runtime.restyle = callback;
        },
      });
      const figure = { data: [], layout: {}, frames: [] };
      runtime.draws++;
      onInitialized?.(figure, graph);
      return () => {
        runtime.restyle = undefined;
        onPurge?.(figure, graph);
      };
    }, [onInitialized, onPurge]);
    return <div ref={ref} />;
  },
  Plotly: { Plots: { resize: vi.fn() } },
  registerTraceTypes: vi.fn().mockResolvedValue(undefined),
}));

describe("PlotlyChart restyle events", () => {
  it("listens again after an Activity purge and calls the current callback", async () => {
    const before = vi.fn();
    const after = vi.fn();
    const plot = (mode: "visible" | "hidden", callback: typeof before) => (
      <Activity mode={mode}>
        <PlotlyChart data={[{ type: "scatter", y: [1, 2] }]} layout={{}} onRestyle={callback} />
      </Activity>
    );
    const view = render(plot("visible", before));
    await waitFor(() => expect(runtime.restyle).toBeDefined());
    const event: PlotRestyleEvent = [{ visible: ["legendonly"] }, [0]];
    runtime.restyle?.(event);
    expect(before).toHaveBeenCalledWith(event);

    view.rerender(plot("hidden", before));
    await waitFor(() => expect(runtime.restyle).toBeUndefined());
    const draws = runtime.draws;
    view.rerender(plot("visible", after));
    await waitFor(() => expect(runtime.restyle).toBeDefined());
    expect(runtime.draws).toBeGreaterThan(draws);
    runtime.restyle?.(event);
    expect(after).toHaveBeenCalledWith(event);
    expect(before).toHaveBeenCalledTimes(1);
  });
});
