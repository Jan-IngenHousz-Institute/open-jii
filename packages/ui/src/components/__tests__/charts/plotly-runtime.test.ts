import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { EAGER_TRACE_TYPES, LAZY_TRACE_TYPES } from "../../charts/plotly-trace-types";

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

async function registeredTypes(): Promise<string[]> {
  const { Plotly } = await import("../../charts/plotly-runtime");
  if (!hasPlotSchema(Plotly)) {
    throw new Error("Plotly runtime exposes no PlotSchema");
  }
  return Object.keys(Plotly.PlotSchema.get().traces).sort();
}

const sorted = (types: readonly string[]) => [...types].sort();

// Registered alongside contourcarpet, so it adds nothing once that case has run.
const CARPET_FAMILY = new Set(["carpet", "contourcarpet"]);

// Plotly's registry lives as long as the module does, so these cases build on
// each other and run in order.
describe("plotly runtime", () => {
  beforeAll(() => {
    // jsdom has no canvas; Plotly probes one while loading the WebGL traces.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("registers only what sparklines draw on import", async () => {
    expect(await registeredTypes()).toEqual(sorted(EAGER_TRACE_TYPES));
  });

  it("registers carpet along with a trace drawn on its axes", async () => {
    const { registerTraceTypes } = await import("../../charts/plotly-runtime");

    await registerTraceTypes(["contourcarpet"]);

    expect(await registeredTypes()).toEqual(
      sorted([...EAGER_TRACE_TYPES, "carpet", "contourcarpet"]),
    );
  });

  it.each(LAZY_TRACE_TYPES.filter((type) => !CARPET_FAMILY.has(type)))(
    "registers %s and nothing else",
    async (type) => {
      const { registerTraceTypes } = await import("../../charts/plotly-runtime");
      const before = new Set(await registeredTypes());

      await registerTraceTypes([type]);

      const added = (await registeredTypes()).filter((registered) => !before.has(registered));
      expect(added).toEqual([type]);
    },
  );

  it("ends up with every type the wrappers emit", async () => {
    expect(await registeredTypes()).toEqual(sorted([...EAGER_TRACE_TYPES, ...LAZY_TRACE_TYPES]));
  });
});
