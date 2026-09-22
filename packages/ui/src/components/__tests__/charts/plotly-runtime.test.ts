import { afterEach, describe, expect, it, vi } from "vitest";

// Every trace type a wrapper can emit, including the WebGL twin of scatter.
const EMITTED_TRACE_TYPES = [
  "bar",
  "barpolar",
  "box",
  "carpet",
  "contour",
  "contourcarpet",
  "heatmap",
  "histogram",
  "histogram2d",
  "histogram2dcontour",
  "parcats",
  "parcoords",
  "pie",
  "sankey",
  "scatter",
  "scattercarpet",
  "scattergl",
  "scatterpolar",
  "scatterternary",
  "violin",
];

interface PlotSchemaCarrier {
  PlotSchema: { get(): { traces: Record<string, unknown> } };
}

// The typings stop short of `PlotSchema`, which is where the registry shows.
function hasPlotSchema(value: object): value is PlotSchemaCarrier {
  if (!("PlotSchema" in value)) {
    return false;
  }
  const schema: unknown = value.PlotSchema;
  return (
    typeof schema === "object" &&
    schema !== null &&
    "get" in schema &&
    typeof schema.get === "function"
  );
}

describe("plotly runtime", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers every trace type the wrappers emit and nothing heavier", async () => {
    // jsdom has no canvas; Plotly probes one while loading the WebGL trace.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const { Plotly } = await import("../../charts/plotly-runtime");
    if (!hasPlotSchema(Plotly)) {
      throw new Error("Plotly runtime exposes no PlotSchema");
    }

    const registered = Object.keys(Plotly.PlotSchema.get().traces).sort();

    expect(registered).toEqual([...EMITTED_TRACE_TYPES].sort());
  });
});
