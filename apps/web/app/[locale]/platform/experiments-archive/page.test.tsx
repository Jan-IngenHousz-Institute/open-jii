import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import ExperimentArchivePage from "./page";

globalThis.React = React;

vi.mock("@repo/i18n/server", () => ({
  __esModule: true,
  default: vi.fn(() => Promise.resolve({ t: (key: string) => key })),
}));

vi.mock("@/components/list-experiments", () => ({
  ListExperiments: ({ archived }: { archived: boolean }) => (
    <div data-testid="list-experiments" data-archived={archived}>
      List of {archived ? "Archived" : "Active"} Experiments
    </div>
  ),
}));

describe("ExperimentArchivePage", () => {
  const locale = "en-US";
  const defaultProps = {
    params: Promise.resolve({ locale }),
  };

  it("renders the experiments archive page with all components", async () => {
    render(await ExperimentArchivePage(defaultProps));

    expect(screen.getByText("experiments.archiveTitle")).toBeInTheDocument();
    expect(screen.getByText("experiments.archiveDescription")).toBeInTheDocument();
    expect(screen.getByTestId("list-experiments")).toBeInTheDocument();
  });

  it("passes archived=true to ListExperiments component", async () => {
    render(await ExperimentArchivePage(defaultProps));

    const listComponent = screen.getByTestId("list-experiments");
    expect(listComponent).toHaveAttribute("data-archived", "true");
  });
});
