import { createExperiment } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { ExperimentOverviewCards } from "./experiment-overview-cards";

vi.mock("@repo/ui/components/charts/line-chart", () => ({
  LineChart: ({ data }: { data: { y: number[] }[] }) => (
    <div data-testid="sparkline">{JSON.stringify(data[0]?.y ?? [])}</div>
  ),
}));

const series = (counts: number[]) => ({
  measurements: counts.reduce((sum, count) => sum + count, 0),
  days: counts.map((measurements, index) => ({
    date: `2026-06-${String(index + 1).padStart(2, "0")}`,
    measurements,
  })),
});

describe("ExperimentOverviewCards", () => {
  it("shows skeleton loaders while loading", () => {
    render(<ExperimentOverviewCards experiments={undefined} />);
    // Loading state: no experiment content or empty-state message
    expect(screen.queryByText("experiments.noExperiments")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows empty message when no experiments", () => {
    render(<ExperimentOverviewCards experiments={[]} />);
    expect(screen.getByText("experiments.noExperiments")).toBeInTheDocument();
  });

  it("shows a docs help link in the empty state when showGetStartedHelp is set", () => {
    render(<ExperimentOverviewCards experiments={[]} showGetStartedHelp />);
    expect(screen.getByRole("link").getAttribute("href")).toContain(
      "/guide/get-started/quick-start",
    );
  });

  it("renders experiment cards with name, description and status", () => {
    const exp = createExperiment({
      name: "Photosynthesis Study",
      description: "Measuring chlorophyll",
      status: "active",
    });
    render(<ExperimentOverviewCards experiments={[exp]} />);
    expect(screen.getByText("Photosynthesis Study")).toBeInTheDocument();
    expect(screen.getByText("Measuring chlorophyll")).toBeInTheDocument();
    // Shares the row the visibility badge reserves anyway, so it costs no height.
    expect(screen.getByText("status.active")).toBeInTheDocument();
  });

  it("badges a private experiment, the way the other resource lists do", () => {
    render(<ExperimentOverviewCards experiments={[createExperiment({ visibility: "private" })]} />);
    expect(screen.getByText("resourceVisibility.privateStatus")).toBeInTheDocument();
  });

  it("leaves a public experiment unbadged", () => {
    render(<ExperimentOverviewCards experiments={[createExperiment({ visibility: "public" })]} />);
    // "Public" is the unremarkable default; only the exception is worth marking.
    expect(screen.queryByText("resourceVisibility.privateStatus")).not.toBeInTheDocument();
    expect(screen.queryByText("resourceVisibility.publicStatus")).not.toBeInTheDocument();
  });

  it("links to the correct experiment page", () => {
    render(<ExperimentOverviewCards experiments={[createExperiment({ id: "abc-123" })]} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/en-US/platform/experiments/abc-123");
  });

  it("links to archive path when archived", () => {
    render(
      <ExperimentOverviewCards experiments={[createExperiment({ id: "abc-123" })]} archived />,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/en-US/platform/experiments-archive/abc-123",
    );
  });

  it("renders multiple cards", () => {
    const exps = [
      createExperiment({ name: "A" }),
      createExperiment({ name: "B" }),
      createExperiment({ name: "C" }),
    ];
    render(<ExperimentOverviewCards experiments={exps} />);
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("shows last-updated date", () => {
    render(
      <ExperimentOverviewCards
        experiments={[createExperiment({ updatedAt: "2025-06-15T00:00:00.000Z" })]}
      />,
    );
    expect(screen.getByText(/lastUpdate/)).toBeInTheDocument();
  });

  it("plots the measurement window when the row carries one", () => {
    render(
      <ExperimentOverviewCards experiments={[createExperiment({ activity: series([1, 4, 2]) })]} />,
    );
    expect(screen.getByText("resourceMetrics.experiment.measurements")).toBeInTheDocument();
    expect(screen.getByTestId("sparkline")).toHaveTextContent("[1,4,2]");
  });

  it("says the window was quiet rather than dropping the block", () => {
    render(
      <ExperimentOverviewCards experiments={[createExperiment({ activity: series([0, 0]) })]} />,
    );
    expect(screen.getByText("resourceMetrics.quiet")).toBeInTheDocument();
    expect(screen.queryByTestId("sparkline")).not.toBeInTheDocument();
  });

  it("claims nothing when no series came back at all", () => {
    // `null` is also what a failed warehouse read looks like, so it cannot be
    // reported as a zero the way a real empty window is.
    render(<ExperimentOverviewCards experiments={[createExperiment({ activity: null })]} />);
    expect(screen.queryByText("resourceMetrics.quiet")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sparkline")).not.toBeInTheDocument();
  });

  it("handles null description gracefully", () => {
    const exp = createExperiment({ description: null });
    render(<ExperimentOverviewCards experiments={[exp]} />);
    expect(screen.getByText(exp.name)).toBeInTheDocument();
  });
});
