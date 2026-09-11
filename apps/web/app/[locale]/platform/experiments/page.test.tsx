import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import Page from "./page";

vi.mock("@/components/list-experiments", () => ({
  ListExperiments: () => <div data-testid="list-experiments">Experiments list</div>,
}));

describe("ExperimentPage", () => {
  const renderPage = () => render(<Page />);

  it("does not repeat the shell heading", () => {
    renderPage();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("renders the experiment list component", () => {
    renderPage();
    expect(screen.getByTestId("list-experiments")).toBeInTheDocument();
  });
});
