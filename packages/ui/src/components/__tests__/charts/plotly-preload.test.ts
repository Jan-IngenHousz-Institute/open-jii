import { describe, expect, it, vi } from "vitest";

const loadRuntime = vi.hoisted(() => vi.fn(() => ({ Plot: () => null, Plotly: {} })));

vi.mock("../../charts/plotly-runtime", loadRuntime);

describe("preloadPlotly", () => {
  it("imports the Plotly runtime without rendering a chart", async () => {
    const { preloadPlotly } = await import("../../charts/plotly-chart");
    expect(loadRuntime).not.toHaveBeenCalled();

    preloadPlotly();

    await vi.waitFor(() => expect(loadRuntime).toHaveBeenCalledTimes(1));
  });
});
