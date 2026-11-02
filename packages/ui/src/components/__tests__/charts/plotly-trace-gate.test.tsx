import { act, render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlotlyErrorBoundary } from "../../charts/plotly-error-boundary";
import { PlotlyTraceGate } from "../../charts/plotly-trace-gate";

const registerTraceTypes = vi.hoisted(() => vi.fn<(types: readonly string[]) => Promise<void>>());
vi.mock("../../charts/plotly-runtime", () => ({ registerTraceTypes }));

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// Suspended renders resume inside an awaited act.
async function renderGate(types: string[]) {
  await act(async () => {
    render(
      <Suspense fallback={<p>loading</p>}>
        <PlotlyTraceGate types={types}>
          <p>chart</p>
        </PlotlyTraceGate>
      </Suspense>,
    );
  });
}

describe("PlotlyTraceGate", () => {
  beforeEach(() => {
    registerTraceTypes.mockReset();
    registerTraceTypes.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the chart straight away when Plotly has every type", () => {
    render(
      <Suspense fallback={<p>loading</p>}>
        <PlotlyTraceGate types={["bar"]}>
          <p>chart</p>
        </PlotlyTraceGate>
      </Suspense>,
    );

    expect(screen.getByText("chart")).toBeInTheDocument();
    expect(screen.queryByText("loading")).not.toBeInTheDocument();
  });

  it("holds the chart on the fallback until its families are registered", async () => {
    const consoleError = vi.spyOn(console, "error");
    const load = deferred();
    registerTraceTypes.mockReturnValue(load.promise);

    await renderGate(["box"]);

    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(screen.queryByText("chart")).not.toBeInTheDocument();

    await act(async () => {
      load.resolve();
      await load.promise;
    });

    expect(screen.getByText("chart")).toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("waits for changed trace types and immediately reuses a previously registered type", async () => {
    const gate = (types: string[]) => (
      <Suspense fallback={<p>loading</p>}>
        <PlotlyTraceGate types={types}>
          <p>chart</p>
        </PlotlyTraceGate>
      </Suspense>
    );
    const view = render(gate(["pie"]));
    await act(async () => undefined);
    expect(screen.getByText("chart")).toBeInTheDocument();

    const load = deferred();
    registerTraceTypes.mockReturnValueOnce(load.promise);
    view.rerender(gate(["violin"]));
    expect(screen.getByText("loading")).toBeVisible();
    await act(async () => {
      load.resolve();
      await load.promise;
    });
    expect(screen.getByText("chart")).toBeVisible();

    const calls = registerTraceTypes.mock.calls.length;
    view.rerender(gate(["pie"]));
    expect(screen.queryByText("loading")).not.toBeInTheDocument();
    expect(registerTraceTypes).toHaveBeenCalledTimes(calls);
  });

  it("hands a failed load to the nearest error boundary", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    registerTraceTypes.mockRejectedValueOnce(new Error("chunk failed"));
    const onError = vi.fn();

    await act(async () => {
      render(
        <PlotlyErrorBoundary onError={onError}>
          <Suspense fallback={<p>loading</p>}>
            <PlotlyTraceGate types={["sankey"]}>
              <p>chart</p>
            </PlotlyTraceGate>
          </Suspense>
        </PlotlyErrorBoundary>,
      );
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("chart")).not.toBeInTheDocument();
  });
});
