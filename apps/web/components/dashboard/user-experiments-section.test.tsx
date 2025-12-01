import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { UserExperimentsSection } from "./user-experiments-section";

globalThis.React = React;

// --- Mocks ---
const mockUseExperiments = vi.fn();

vi.mock("~/hooks/experiment/useExperiments/useExperiments", () => ({
  useExperiments: (): { data?: { body: { id: string; title: string }[] } } =>
    mockUseExperiments() as { data?: { body: { id: string; title: string }[] } },
}));

// --- Tests ---
describe("<UserExperimentsSection />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 3 skeletons when no data is available", () => {
    mockUseExperiments.mockReturnValue({ data: undefined });

    render(<UserExperimentsSection />);

    // Find all skeleton divs by their class
    const skeletons = document.querySelectorAll(".h-32");
    expect(skeletons).toHaveLength(3);
  });

  it("renders only first 3 experiments when data is available", () => {
    const experiments = [
      { id: "1", title: "Experiment 1" },
      { id: "2", title: "Experiment 2" },
      { id: "3", title: "Experiment 3" },
      { id: "4", title: "Experiment 4" }, // should be sliced off
    ];
    mockUseExperiments.mockReturnValue({ data: { body: experiments } });

    render(<UserExperimentsSection />);

    // Each experiment card has a link with /platform/experiments/:id
    const links = screen.getAllByRole("link", { name: "experiments.viewDetails" });
    expect(links).toHaveLength(3);

    // The hrefs are correct for the first 3
    expect(links[0]).toHaveAttribute("href", "/platform/experiments/1");
    expect(links[1]).toHaveAttribute("href", "/platform/experiments/2");
    expect(links[2]).toHaveAttribute("href", "/platform/experiments/3");
  });
});
