import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ChartConfigError, ChartFrame } from "../chart-frame";

const baseProps = {
  visualization: createVisualization({ id: "viz-1" }),
  experimentId: "exp-1",
  hasRows: true,
};

describe("ChartFrame", () => {
  it("renders the loading placeholder when isLoading", () => {
    render(
      <ChartFrame {...baseProps} isLoading error={undefined}>
        <div>chart-body</div>
      </ChartFrame>,
    );
    expect(screen.getByText("errors.loadingData")).toBeInTheDocument();
    expect(screen.queryByText("chart-body")).not.toBeInTheDocument();
  });

  it("renders the failure card when error is set, even if rows are present", () => {
    render(
      <ChartFrame {...baseProps} isLoading={false} error={new Error("boom")}>
        <div>chart-body</div>
      </ChartFrame>,
    );
    expect(screen.getByText("errors.failedToLoadData")).toBeInTheDocument();
    expect(screen.queryByText("chart-body")).not.toBeInTheDocument();
  });

  it("renders the no-data card when rows is empty and no other error", () => {
    render(
      <ChartFrame {...baseProps} isLoading={false} error={undefined} hasRows={false}>
        <div>chart-body</div>
      </ChartFrame>,
    );
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
    expect(screen.queryByText("chart-body")).not.toBeInTheDocument();
  });

  it("renders children when not loading, no error, and rows are present", () => {
    render(
      <ChartFrame {...baseProps} isLoading={false} error={undefined}>
        <div>chart-body</div>
      </ChartFrame>,
    );
    expect(screen.getByText("chart-body")).toBeInTheDocument();
    expect(screen.queryByText("errors.loadingData")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.failedToLoadData")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("hides the configLink in the error card when the visualization id is the preview placeholder", () => {
    render(
      <ChartFrame
        {...baseProps}
        visualization={createVisualization({ id: "preview" })}
        isLoading={false}
        error={new Error("boom")}
      >
        <div>chart-body</div>
      </ChartFrame>,
    );
    // Trans renders the config link as a span (not <a>) when no real id is
    // available, so there must be no link in the rendered output.
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("ChartConfigError", () => {
  it("renders a configuration-error card with the given message", () => {
    render(<ChartConfigError message="bad chart type" />);
    expect(screen.getByText("errors.configuration")).toBeInTheDocument();
    expect(screen.getByText("bad chart type")).toBeInTheDocument();
  });
});
