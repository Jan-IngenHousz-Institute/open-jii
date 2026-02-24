import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { UserExperimentsSection } from "./user-experiments-section";

const mockUseExperiments = vi.fn();
vi.mock("~/hooks/experiment/useExperiments/useExperiments", () => ({
  useExperiments: (...args: unknown[]) => mockUseExperiments(...args),
}));

vi.mock("~/components/experiment-overview-cards", () => ({
  ExperimentOverviewCards: (props: { experiments?: unknown[] }) => (
    <div data-testid="experiment-cards">{props.experiments?.length ?? 0} experiments</div>
  ),
}));

describe("UserExperimentsSection", () => {
  it("shows skeletons while loading", () => {
    mockUseExperiments.mockReturnValue({ data: undefined });
    render(<UserExperimentsSection />);

    expect(screen.queryByTestId("experiment-cards")).not.toBeInTheDocument();
  });

  it("shows first 3 experiments", () => {
    mockUseExperiments.mockReturnValue({
      data: { body: [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }] },
    });

    render(<UserExperimentsSection />);

    expect(screen.getByTestId("experiment-cards")).toHaveTextContent("3 experiments");
  });
});
