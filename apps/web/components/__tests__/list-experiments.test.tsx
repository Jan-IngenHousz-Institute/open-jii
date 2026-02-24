import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useExperiments } from "~/hooks/experiment/useExperiments/useExperiments";

import { ListExperiments } from "../list-experiments";

vi.mock("~/hooks/experiment/useExperiments/useExperiments", () => ({
  useExperiments: vi.fn(),
}));

vi.mock("~/components/experiment-overview-cards", () => ({
  ExperimentOverviewCards: ({ experiments }: { experiments?: unknown[] }) => (
    <div data-testid="experiment-cards">{JSON.stringify(experiments)}</div>
  ),
}));

const mockSetSearch = vi.fn();

function setupHook(overrides: Record<string, unknown> = {}) {
  vi.mocked(useExperiments).mockReturnValue({
    data: { body: [{ id: "1", name: "Exp 1" }] },
    filter: "member",
    setFilter: vi.fn(),
    status: undefined,
    setStatus: vi.fn(),
    search: "",
    setSearch: mockSetSearch,
    ...overrides,
  } as never);
}

describe("ListExperiments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHook();
  });

  it("renders experiments via ExperimentOverviewCards", () => {
    render(<ListExperiments />);
    expect(screen.getByTestId("experiment-cards")).toHaveTextContent("Exp 1");
  });

  it("renders empty state when no experiments", () => {
    setupHook({ data: { body: [] } });
    render(<ListExperiments />);
    expect(screen.getByTestId("experiment-cards")).toHaveTextContent("[]");
  });

  it("updates search on input change", async () => {
    const user = userEvent.setup();
    render(<ListExperiments />);
    await user.type(screen.getByPlaceholderText("experiments.searchExperiments"), "abc");
    expect(mockSetSearch).toHaveBeenCalled();
  });

  it("shows clear button when search is active", async () => {
    setupHook({ search: "abc" });
    const user = userEvent.setup();
    render(<ListExperiments />);
    await user.click(screen.getByRole("button", { name: "experiments.clearSearch" }));
    expect(mockSetSearch).toHaveBeenCalledWith("");
  });
});
