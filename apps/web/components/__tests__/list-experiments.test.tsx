import { createExperiment } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api";

import { ListExperiments } from "../list-experiments";

vi.mock("~/components/experiment-overview-cards", () => ({
  ExperimentOverviewCards: ({ experiments }: { experiments?: unknown[] }) => (
    <div data-testid="experiment-cards">{JSON.stringify(experiments)}</div>
  ),
}));

describe("ListExperiments", () => {
  it("renders experiments via ExperimentOverviewCards", async () => {
    server.mount(contract.experiments.listExperiments, {
      body: [createExperiment({ id: "1", name: "Exp 1" })],
    });

    render(<ListExperiments />);

    await waitFor(() => {
      expect(screen.getByTestId("experiment-cards")).toHaveTextContent("Exp 1");
    });
  });

  it("renders empty state when no experiments", async () => {
    server.mount(contract.experiments.listExperiments, { body: [] });

    render(<ListExperiments />);

    await waitFor(() => {
      expect(screen.getByTestId("experiment-cards")).toHaveTextContent("[]");
    });
  });

  it("updates search on input change", async () => {
    server.mount(contract.experiments.listExperiments, { body: [] });

    const user = userEvent.setup();
    render(<ListExperiments />);

    const input = screen.getByPlaceholderText("experiments.searchExperiments");
    await user.type(input, "abc");

    expect(input).toHaveValue("abc");
  });

  it("shows clear button when search is active and clears on click", async () => {
    server.mount(contract.experiments.listExperiments, { body: [] });

    const user = userEvent.setup();
    render(<ListExperiments />);

    const input = screen.getByPlaceholderText("experiments.searchExperiments");
    await user.type(input, "abc");
    expect(input).toHaveValue("abc");

    await user.click(screen.getByRole("button", { name: "experiments.clearSearch" }));
    expect(input).toHaveValue("");
  });
});
