import { createExperiment } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { ExperimentOverviewCards } from "./experiment-overview-cards";

describe("ExperimentOverviewCards", () => {
  describe("loading state", () => {
    it("renders skeleton loaders when experiments is undefined", () => {
      const { container } = render(<ExperimentOverviewCards experiments={undefined} />);
      const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe("empty state", () => {
    it("renders no experiments message when array is empty", () => {
      render(<ExperimentOverviewCards experiments={[]} />);
      expect(screen.getByText("No experiments found")).toBeInTheDocument();
    });
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

  describe("different experiment statuses", () => {
    it("renders experiment with archived status", () => {
      const experiment = { ...mockExperiment, status: "archived" as const };
      render(<ExperimentOverviewCards experiments={[experiment]} />);
      expect(screen.getByTestId("status-badge")).toHaveTextContent("archived");
    });

    it("renders experiment with stale status", () => {
      const experiment = { ...mockExperiment, status: "stale" as const };
      render(<ExperimentOverviewCards experiments={[experiment]} />);
      expect(screen.getByTestId("status-badge")).toHaveTextContent("stale");
    });
  });
});
