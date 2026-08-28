import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import ExperimentArchivePage from "./page";

vi.mock("@/components/list-experiments", () => ({
  ListExperiments: ({ archived }: { archived: boolean }) => (
    <div data-testid="list-experiments" data-archived={String(archived)} />
  ),
}));

const defaultProps = { params: Promise.resolve({ locale: "en-US" }) };

describe("ExperimentArchivePage", () => {
  it("lets the shell own the title and renders the archived list", () => {
    render(ExperimentArchivePage(defaultProps));

    expect(screen.queryByText("experiments.archiveTitle")).not.toBeInTheDocument();

    const list = screen.getByTestId("list-experiments");
    expect(list).toHaveAttribute("data-archived", "true");
  });
});
