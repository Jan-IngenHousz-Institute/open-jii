import { act, render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlotlyErrorBoundary } from "../../charts/plotly-error-boundary";
import { pendingTraceTypes } from "../../charts/plotly-loader";
import { PlotlyTraceGate } from "../../charts/plotly-trace-gate";

vi.mock("../../charts/plotly-loader", () => ({ pendingTraceTypes: vi.fn() }));

const pending = vi.mocked(pendingTraceTypes);

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// A render that suspends on `use()` only resumes inside an awaited `act`.
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
  afterEach(() => {
    vi.restoreAllMocks();
    pending.mockReset();
  });

  it("renders the chart straight away when Plotly has every type", async () => {
    pending.mockReturnValue(null);

    await renderGate(["bar"]);

    expect(screen.getByText("chart")).toBeInTheDocument();
    expect(screen.queryByText("loading")).not.toBeInTheDocument();
  });

  it("holds the chart on the fallback until its families are registered", async () => {
    const consoleError = vi.spyOn(console, "error");
    const load = deferred();
    let registered = false;
    pending.mockImplementation(() => (registered ? null : load.promise));

    await renderGate(["box"]);

    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(screen.queryByText("chart")).not.toBeInTheDocument();

    await act(async () => {
      registered = true;
      load.resolve();
      await load.promise;
    });

    expect(screen.getByText("chart")).toBeInTheDocument();
    const uncached = consoleError.mock.calls.filter((call) => String(call[0]).includes("uncached"));
    expect(uncached).toEqual([]);
  });

  it("hands a failed load to the nearest error boundary", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = Promise.reject(new Error("chunk failed"));
    failure.catch(() => undefined);
    pending.mockReturnValue(failure);
    const onError = vi.fn();

    await act(async () => {
      render(
        <PlotlyErrorBoundary onError={onError}>
          <Suspense fallback={<p>loading</p>}>
            <PlotlyTraceGate types={["box"]}>
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
