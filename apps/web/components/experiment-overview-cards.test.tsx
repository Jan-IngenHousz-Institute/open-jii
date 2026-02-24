import { createExperiment } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { ExperimentOverviewCards } from "./experiment-overview-cards";

describe("ExperimentOverviewCards", () => {
  it("shows skeleton loaders while loading", () => {
    const { container } = render(<ExperimentOverviewCards experiments={undefined} />);
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });

  it("shows empty message when no experiments", () => {
    render(<ExperimentOverviewCards experiments={[]} />);
    expect(screen.getByText("experiments.noExperiments")).toBeInTheDocument();
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
    expect(screen.getByText("status.active")).toBeInTheDocument();
  });

  it("links to the correct experiment page", () => {
    render(<ExperimentOverviewCards experiments={[createExperiment({ id: "abc-123" })]} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/platform/experiments/abc-123");
  });

  it("links to archive path when archived", () => {
    render(
      <ExperimentOverviewCards experiments={[createExperiment({ id: "abc-123" })]} archived />,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/platform/experiments-archive/abc-123",
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

  it("handles null description gracefully", () => {
    const exp = createExperiment({ description: null });
    render(<ExperimentOverviewCards experiments={[exp]} />);
    expect(screen.getByText(exp.name)).toBeInTheDocument();
  });
});
