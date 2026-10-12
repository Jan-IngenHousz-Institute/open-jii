import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const registerTraceTypes = vi.hoisted(() => vi.fn<(types: readonly string[]) => Promise<void>>());

vi.mock("../../charts/plotly-runtime", () => ({ registerTraceTypes }));

// The loader remembers what it has registered, so each case starts from a fresh copy.
async function freshLoader() {
  vi.resetModules();
  return import("../../charts/plotly-loader");
}

describe("pendingTraceTypes", () => {
  beforeEach(() => {
    registerTraceTypes.mockReset();
    registerTraceTypes.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("owes nothing for the types the runtime registers up front", async () => {
    const { pendingTraceTypes } = await freshLoader();

    expect(pendingTraceTypes(["scatter", "bar"])).toBeNull();
    expect(pendingTraceTypes([])).toBeNull();
    expect(registerTraceTypes).not.toHaveBeenCalled();
  });

  it("hands back one promise for the same missing types until they land", async () => {
    const { pendingTraceTypes } = await freshLoader();

    const first = pendingTraceTypes(["violin", "box", "box"]);
    const second = pendingTraceTypes(["box", "violin"]);

    expect(second).toBe(first);
    await first;
    expect(registerTraceTypes).toHaveBeenCalledTimes(1);
    expect(registerTraceTypes).toHaveBeenCalledWith(["box", "violin"]);
    expect(pendingTraceTypes(["box", "violin", "scatter"])).toBeNull();
  });

  it("only asks for the types still missing", async () => {
    const { pendingTraceTypes } = await freshLoader();

    await pendingTraceTypes(["box"]);
    await pendingTraceTypes(["box", "pie"]);

    expect(registerTraceTypes).toHaveBeenLastCalledWith(["pie"]);
  });

  it("keeps a failed load, so a render that retries sees the failure", async () => {
    const { pendingTraceTypes } = await freshLoader();
    registerTraceTypes.mockRejectedValueOnce(new Error("chunk failed"));

    const first = pendingTraceTypes(["sankey"]);

    await expect(first).rejects.toThrow("chunk failed");
    expect(pendingTraceTypes(["sankey"])).toBe(first);
    expect(registerTraceTypes).toHaveBeenCalledTimes(1);
  });

  it("warns once about a type it cannot load and does not wait on it", async () => {
    const { pendingTraceTypes } = await freshLoader();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(pendingTraceTypes(["contourternary"])).toBeNull();
    pendingTraceTypes(["contourternary"]);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("contourternary");
  });
});

describe("loadedPlotlyRuntime", () => {
  it("is empty until the runtime has loaded, then hands it back without waiting", async () => {
    const { loadPlotlyRuntime, loadedPlotlyRuntime } = await freshLoader();

    expect(loadedPlotlyRuntime()).toBeUndefined();

    const runtime = await loadPlotlyRuntime();

    expect(loadedPlotlyRuntime()).toBe(runtime);
  });
});
