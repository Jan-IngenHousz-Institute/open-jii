import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlotlyErrorBoundary } from "../../charts/plotly-error-boundary";

function Broken(): never {
  throw new Error("chunk failed");
}

describe("PlotlyErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders its children when nothing fails", () => {
    const onError = vi.fn();

    render(
      <PlotlyErrorBoundary onError={onError}>
        <p>chart</p>
      </PlotlyErrorBoundary>,
    );

    expect(screen.getByText("chart")).toBeInTheDocument();
    expect(onError).not.toHaveBeenCalled();
  });

  it("reports a failure once and renders nothing in its place", () => {
    // React logs every caught error; the boundary's own report is what matters here.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const onError = vi.fn();

    const { container } = render(
      <PlotlyErrorBoundary onError={onError}>
        <Broken />
      </PlotlyErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "chunk failed" }));
    expect(container).toBeEmptyDOMElement();
  });
});
