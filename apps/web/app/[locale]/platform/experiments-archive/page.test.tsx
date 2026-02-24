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
  it("renders title, description, and archived list", async () => {
    render(await ExperimentArchivePage(defaultProps));

    expect(screen.getByText("experiments.archiveTitle")).toBeInTheDocument();
    expect(screen.getByText("experiments.archiveDescription")).toBeInTheDocument();

    const list = screen.getByTestId("list-experiments");
    expect(list).toHaveAttribute("data-archived", "true");
  });
});
