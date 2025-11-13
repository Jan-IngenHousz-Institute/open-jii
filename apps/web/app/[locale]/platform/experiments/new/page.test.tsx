import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import NewExperimentPage from "./page";

globalThis.React = React;

vi.mock("@repo/i18n/server", () => ({
  __esModule: true,
  default: vi.fn(() => Promise.resolve({ t: (key: string) => key })),
}));

vi.mock("@/components/new-experiment", () => ({
  NewExperimentForm: () => <div data-testid="new-experiment-form">New Experiment Form</div>,
}));

describe("NewExperimentPage", () => {
  const locale = "en-US";
  const defaultProps = {
    params: Promise.resolve({ locale }),
  };

  it("renders the new experiment page with all components", async () => {
    render(await NewExperimentPage(defaultProps));

    expect(screen.getByText("experiments.newExperiment")).toBeInTheDocument();
    expect(screen.getByText("newExperiment.description")).toBeInTheDocument();
    expect(screen.getByTestId("new-experiment-form")).toBeInTheDocument();
  });
});
