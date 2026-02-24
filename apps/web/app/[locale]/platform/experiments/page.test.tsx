import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/components/list-experiments", () => ({
  ListExperiments: () => <div data-testid="list-experiments">Experiments list</div>,
}));

describe("ExperimentPage", () => {
  const renderPage = async () => {
    const { default: Page } = await import("./page");
    const ui = await Page({ params: Promise.resolve({ locale: "en-US" }) });
    return render(ui);
  };

  it("renders heading and description", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("experiments.title");
    expect(screen.getByText("experiments.listDescription")).toBeInTheDocument();
  });

  it("shows archive link", async () => {
    await renderPage();
    expect(screen.getByText("experiments.viewArchived")).toBeInTheDocument();
  });

  it("shows create and transfer-request buttons", async () => {
    await renderPage();
    expect(screen.getByText("experiments.create")).toBeInTheDocument();
    expect(screen.getByText("transferRequest.title")).toBeInTheDocument();
  });

  it("renders the experiment list component", async () => {
    await renderPage();
    expect(screen.getByTestId("list-experiments")).toBeInTheDocument();
  });
});
