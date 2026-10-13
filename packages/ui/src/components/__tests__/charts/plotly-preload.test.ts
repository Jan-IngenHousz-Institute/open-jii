import { render } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

const registerTraceTypes = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const loadRuntime = vi.hoisted(() =>
  vi.fn(() => ({ Plot: () => null, Plotly: {}, registerTraceTypes })),
);

vi.mock("../../charts/plotly-runtime", loadRuntime);

describe("preloadPlotly", () => {
  it("imports the Plotly runtime without rendering a chart", async () => {
    const { preloadPlotly } = await import("../../charts/plotly-chart");
    expect(loadRuntime).not.toHaveBeenCalled();

    preloadPlotly();

    await vi.waitFor(() => expect(loadRuntime).toHaveBeenCalledTimes(1));
  });

  it("warms the families it is given and skips the ones core already has", async () => {
    const { preloadPlotly } = await import("../../charts/plotly-chart");

    preloadPlotly(["bar", "scatter"]);
    preloadPlotly(["box", "bar"]);

    await vi.waitFor(() => expect(registerTraceTypes).toHaveBeenCalledTimes(1));
    expect(registerTraceTypes).toHaveBeenCalledWith(["box"]);
  });

  it("warms the families of the chart that will follow", async () => {
    const { PlotlyPreload } = await import("../../charts/plotly-preload");

    render(createElement(PlotlyPreload, { traceTypes: ["violin"] }));

    await vi.waitFor(() => expect(registerTraceTypes).toHaveBeenCalledWith(["violin"]));
  });
});
