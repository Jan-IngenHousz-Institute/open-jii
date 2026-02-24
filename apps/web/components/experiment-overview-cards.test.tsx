/**
 * ExperimentOverviewCards test — renders with real child components
 * (ExperimentStatusBadge, RichTextRenderer, next/link, lucide icons).
 *
 * No mocks needed beyond the global i18n mock from test/setup.ts.
 * Tests focus on what a user would see: experiment names, links,
 * loading skeletons, and empty states.
 */
import { createExperiment } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { ExperimentOverviewCards } from "./experiment-overview-cards";

describe("ExperimentOverviewCards", () => {
  it("shows skeleton loaders while experiments are loading", () => {
    const { container } = render(<ExperimentOverviewCards experiments={undefined} />);
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows an empty message when there are no experiments", () => {
    render(<ExperimentOverviewCards experiments={[]} />);
    expect(screen.getByText("experiments.noExperiments")).toBeInTheDocument();
  });

  it("renders experiment cards with name, description and status", () => {
    const experiment = createExperiment({
      name: "Photosynthesis Study",
      description: "Measuring chlorophyll fluorescence",
      status: "active",
    });

    render(<ExperimentOverviewCards experiments={[experiment]} />);

    expect(screen.getByText("Photosynthesis Study")).toBeInTheDocument();
    expect(screen.getByText("Measuring chlorophyll fluorescence")).toBeInTheDocument();
    // Status badge renders the translated key
    expect(screen.getByText("status.active")).toBeInTheDocument();
  });

  it("links each card to the experiment detail page", () => {
    const experiment = createExperiment({ id: "abc-123" });

    render(<ExperimentOverviewCards experiments={[experiment]} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/platform/experiments/abc-123");
  });

  it("links to the archive path when archived prop is set", () => {
    const experiment = createExperiment({ id: "abc-123" });

    render(<ExperimentOverviewCards experiments={[experiment]} archived />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/platform/experiments-archive/abc-123");
  });

  it("renders multiple experiment cards", () => {
    const experiments = [
      createExperiment({ name: "Study A" }),
      createExperiment({ name: "Study B" }),
      createExperiment({ name: "Study C" }),
    ];

    render(<ExperimentOverviewCards experiments={experiments} />);

    expect(screen.getByText("Study A")).toBeInTheDocument();
    expect(screen.getByText("Study B")).toBeInTheDocument();
    expect(screen.getByText("Study C")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("shows the last-updated date", () => {
    const experiment = createExperiment({
      updatedAt: "2025-06-15T00:00:00.000Z",
    });

    render(<ExperimentOverviewCards experiments={[experiment]} />);

    // The date format depends on locale, but the translation key should appear
    expect(screen.getByText(/lastUpdate/)).toBeInTheDocument();
  });

  it("gracefully handles a null description", () => {
    const experiment = createExperiment({ description: null });

    render(<ExperimentOverviewCards experiments={[experiment]} />);

    // Should still render the card without crashing
    expect(screen.getByText(experiment.name)).toBeInTheDocument();
  });
});
