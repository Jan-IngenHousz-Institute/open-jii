import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import ExperimentSettingsPage from "./page";

globalThis.React = React;

// --- Mocks ---
vi.mock("@repo/i18n/server", () => ({
  __esModule: true,
  default: vi.fn(() => Promise.resolve({ t: (key: string) => key })),
}));

vi.mock("@/components/experiment-settings", () => ({
  ExperimentSettings: ({ experimentId }: { experimentId: string }) => (
    <div data-testid="experiment-settings" data-experiment-id={experimentId}>
      Experiment Settings for {experimentId}
    </div>
  ),
}));

// --- Tests ---
describe("ExperimentSettingsPage", () => {
  const locale = "en-US";
  const experimentId = "exp-123";
  const defaultProps = {
    params: Promise.resolve({ locale, id: experimentId }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the experiment settings page with all components", async () => {
    render(await ExperimentSettingsPage(defaultProps));

    expect(screen.getByText("experiments.settings")).toBeInTheDocument();
    expect(screen.getByText("experiments.settingsDescription")).toBeInTheDocument();
    expect(screen.getByTestId("experiment-settings")).toBeInTheDocument();
  });

  it("passes correct experiment ID to ExperimentSettings component", async () => {
    render(await ExperimentSettingsPage(defaultProps));

    const settingsComponent = screen.getByTestId("experiment-settings");
    expect(settingsComponent).toHaveAttribute("data-experiment-id", "exp-123");
    expect(settingsComponent).toHaveTextContent("Experiment Settings for exp-123");
  });

  it("renders heading with correct styling", async () => {
    const { container } = render(await ExperimentSettingsPage(defaultProps));

    const heading = container.querySelector("h4");
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass("text-lg", "font-medium");
    expect(heading).toHaveTextContent("experiments.settings");
  });

  it("renders description with correct styling", async () => {
    const { container } = render(await ExperimentSettingsPage(defaultProps));

    const description = container.querySelector("p");
    expect(description).toBeInTheDocument();
    expect(description).toHaveClass("text-muted-foreground", "text-sm");
    expect(description).toHaveTextContent("experiments.settingsDescription");
  });

  it("renders with correct structure and spacing", async () => {
    const { container } = render(await ExperimentSettingsPage(defaultProps));

    const mainDiv = container.querySelector(".space-y-8");
    expect(mainDiv).toBeInTheDocument();

    const settingsDiv = container.querySelector(".space-y-6");
    expect(settingsDiv).toBeInTheDocument();
  });

  it("handles different locale and experiment ID", async () => {
    const differentProps = {
      params: Promise.resolve({ locale: "de", id: "exp-456" }),
    };

    render(await ExperimentSettingsPage(differentProps));

    const settingsComponent = screen.getByTestId("experiment-settings");
    expect(settingsComponent).toHaveAttribute("data-experiment-id", "exp-456");
  });
});
