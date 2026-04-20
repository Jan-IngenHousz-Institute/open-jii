import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import Page from "./page";

vi.mock("@/components/new-experiment", () => ({
  NewExperimentForm: () => <div data-testid="new-experiment-form" />,
}));

describe("NewExperimentPage", () => {
  it("renders heading, description, and form", async () => {
    render(await Page({ params: Promise.resolve({ locale: "en-US" }) }));
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "experiments.newExperiment",
    );
    expect(screen.getByText("newExperiment.description")).toBeInTheDocument();
    expect(screen.getByTestId("new-experiment-form")).toBeInTheDocument();
  });
});
