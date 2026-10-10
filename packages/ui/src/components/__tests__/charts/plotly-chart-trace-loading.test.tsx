import { act, render, screen } from "@testing-library/react";
import type { Data, PlotData } from "plotly.js";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlotlyChart, WebGLContextManager } from "../../charts/plotly-chart";

interface PlotProps {
  data: PlotData[];
  onInitialized?: (figure: { data: PlotData[] }, graphDiv: HTMLElement) => void;
}

const runtime = vi.hoisted(() => ({
  Plot: vi.fn((_props: PlotProps) => null),
  registerTraceTypes: vi.fn<(types: readonly string[]) => Promise<void>>(),
}));

// Only the runtime is faked: lazy, Suspense, the gate and the loader are the real ones.
vi.mock("../../charts/plotly-runtime", () => ({
  Plot: runtime.Plot,
  Plotly: { Plots: { resize: vi.fn() } },
  registerTraceTypes: runtime.registerTraceTypes,
}));

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
} {
  let resolve: () => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function drawnTypes(): (string | undefined)[][] {
  return runtime.Plot.mock.calls.map(([props]) => props.data.map((trace) => trace.type));
}

// A suspended render only resumes inside an awaited `act`, and React holds
// back revealing content for 300ms after a fallback has shown.
const SUSPENSE_REVEAL_MS = 350;

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, SUSPENSE_REVEAL_MS));
  });
}

async function renderChart(data: Data[]) {
  let view: ReturnType<typeof render> | undefined;
  await act(async () => {
    view = render(<PlotlyChart data={data} layout={{}} />);
  });
  await settle();
  if (!view) {
    throw new Error("chart did not render");
  }
  return view;
}

// The loader remembers registrations for the whole file, so each case uses
// trace types no other case has loaded.
describe("PlotlyChart trace loading", () => {
  beforeEach(() => {
    runtime.Plot.mockClear();
    // Reports its first draw the way Plotly's component does, which hands the draw turn on.
    runtime.Plot.mockImplementation(({ data, onInitialized }: PlotProps) => {
      useEffect(() => {
        onInitialized?.({ data }, document.createElement("div"));
        // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on the first draw.
      }, []);
      return null;
    });
    runtime.registerTraceTypes.mockReset();
    runtime.registerTraceTypes.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("waits for a family before drawing it, then draws it", async () => {
    const box = deferred();
    runtime.registerTraceTypes.mockReturnValue(box.promise);

    await renderChart([{ type: "box", y: [1, 2, 3] }]);

    expect(runtime.Plot).not.toHaveBeenCalled();
    expect(screen.getByText("Loading chart...")).toBeInTheDocument();

    box.resolve();
    await settle();

    expect(drawnTypes().at(-1)).toEqual(["box"]);
  });

  it("draws a registered type at once and holds a new one until it lands", async () => {
    const view = await renderChart([{ type: "box", y: [1, 2, 3] }]);
    expect(drawnTypes().at(-1)).toEqual(["box"]);

    const violin = deferred();
    runtime.registerTraceTypes.mockReturnValue(violin.promise);
    runtime.Plot.mockClear();

    await act(async () => {
      view.rerender(<PlotlyChart data={[{ type: "violin", y: [1, 2, 3] }]} layout={{}} />);
    });
    await settle();

    expect(drawnTypes().flat()).not.toContain("violin");

    violin.resolve();
    await settle();

    expect(drawnTypes().at(-1)).toEqual(["violin"]);
  });

  it("draws the SVG twin now and fetches the WebGL family for later", async () => {
    // Fill the context budget so this chart is queued and falls back to SVG.
    const manager = WebGLContextManager.getInstance();
    const busy = Array.from({ length: 7 }, (_, index) => `busy-${index}`);
    for (const chartId of busy) {
      manager.requestContext(chartId, () => undefined);
    }
    runtime.registerTraceTypes.mockReturnValue(deferred().promise);

    const view = await renderChart([{ type: "scattergl", x: [1, 2], y: [1, 2] }]);

    expect(drawnTypes().at(-1)).toEqual(["scatter"]);
    expect(runtime.registerTraceTypes.mock.calls).toContainEqual([["scattergl"]]);

    view.unmount();
    for (const chartId of busy) {
      manager.releaseContext(chartId);
    }
  });

  it("shows the chart's own error when a family fails to load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const sankey = deferred();
    runtime.registerTraceTypes.mockReturnValue(sankey.promise);

    await renderChart([{ type: "sankey" }]);
    sankey.reject(new Error("chunk failed"));
    await settle();

    expect(screen.getByText("Chart Error")).toBeInTheDocument();
    expect(screen.getByText("Rendering error: chunk failed")).toBeInTheDocument();
  });
});
