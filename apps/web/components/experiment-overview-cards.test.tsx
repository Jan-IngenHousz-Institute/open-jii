import { createExperiment } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { ExperimentOverviewCards } from "./experiment-overview-cards";

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

  it("renders experiment cards with name and description", () => {
    const exp = createExperiment({
      name: "Photosynthesis Study",
      description: "Measuring chlorophyll",
      status: "active",
    });
    render(<ExperimentOverviewCards experiments={[exp]} />);
    expect(screen.getByText("Photosynthesis Study")).toBeInTheDocument();
    expect(screen.getByText("Measuring chlorophyll")).toBeInTheDocument();
    // Status is not a fact about an experiment a reader acts on here.
    expect(screen.queryByText("status.active")).not.toBeInTheDocument();
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

  it("shows the always-present metadata: owner, members and last update", () => {
    render(
      <ExperimentOverviewCards
        experiments={[
          createExperiment({
            updatedAt: "2025-06-15T00:00:00.000Z",
            ownerFirstName: "Ada",
            ownerLastName: "Lovelace",
            membersCount: 4,
          }),
        ]}
      />,
    );

    // None of these come from the warehouse, so the card is never bare.
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Jun 15, 2025")).toBeInTheDocument();
  });

  it("handles null description gracefully", () => {
    const exp = createExperiment({ description: null });
    render(<ExperimentOverviewCards experiments={[exp]} />);
    expect(screen.getByText(exp.name)).toBeInTheDocument();
  });
});
