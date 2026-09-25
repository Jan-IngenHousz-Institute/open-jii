import { createVisualization } from "@/test/factories";
import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { ChartConfigError, ChartFrame } from "./chart-frame";

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

  it("says the chart holds part of the data when the read was stopped short", () => {
    render(
      <ChartFrame
        {...baseProps}
        isLoading={false}
        error={undefined}
        truncation={{ shown: 100_000, total: 553_000 }}
      >
        <div>chart-body</div>
      </ChartFrame>,
    );
    expect(screen.getByText("chart-body")).toBeInTheDocument();
    expect(screen.getByText("charts.truncated")).toBeInTheDocument();
  });

  it("says a line is drawn at screen resolution and offers every point", async () => {
    const onToggle = vi.fn();
    render(
      <ChartFrame
        {...baseProps}
        isLoading={false}
        error={undefined}
        resolution={{ isReduced: true, isShowingAll: false, total: 175_000, onToggle }}
      >
        <div>chart-body</div>
      </ChartFrame>,
    );

    expect(screen.getByText("charts.reduced")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "charts.showAllPoints" }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("puts the cut read first when every point of it is shown", () => {
    render(
      <ChartFrame
        {...baseProps}
        isLoading={false}
        error={undefined}
        truncation={{ shown: 100_000, total: 553_000 }}
        resolution={{ isReduced: false, isShowingAll: true, total: 100_000, onToggle: vi.fn() }}
      >
        <div>chart-body</div>
      </ChartFrame>,
    );

    expect(screen.getByText("charts.truncated")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "charts.drawAtResolution" })).toBeInTheDocument();
  });

  it("adds no line for a chart drawing every row it read", () => {
    render(
      <ChartFrame
        {...baseProps}
        isLoading={false}
        error={undefined}
        resolution={{ isReduced: false, isShowingAll: false, total: 200, onToggle: vi.fn() }}
      >
        <div>chart-body</div>
      </ChartFrame>,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows no truncation notice for a complete read", () => {
    render(
      <ChartFrame {...baseProps} isLoading={false} error={undefined}>
        <div>chart-body</div>
      </ChartFrame>,
    );
    expect(screen.queryByText("charts.truncated")).not.toBeInTheDocument();
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
