import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { ListMacros } from "./list-macros";

const mockUseMacros = vi.fn();

vi.mock("~/hooks/macro/useMacros/useMacros", () => ({
  useMacros: (...args: unknown[]) => mockUseMacros(...args),
}));

vi.mock("~/components/macro-overview-cards", () => ({
  MacroOverviewCards: (props: { macros?: unknown[]; isLoading: boolean }) => (
    <div data-testid="macro-cards" data-loading={props.isLoading}>
      {props.macros?.length ?? 0} macros
    </div>
  ),
}));

describe("ListMacros", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMacros.mockReturnValue({ data: [], isLoading: false, error: null });
  });

  it("renders search input and language filter", () => {
    render(<ListMacros />);

    expect(screen.getByPlaceholderText("macros.searchPlaceholder")).toBeInTheDocument();
    expect(screen.getByText("macros.allLanguages")).toBeInTheDocument();
  });

  it("passes data to MacroOverviewCards", () => {
    mockUseMacros.mockReturnValue({ data: [{ id: "1" }], isLoading: false, error: null });
    render(<ListMacros />);

    expect(screen.getByTestId("macro-cards")).toHaveTextContent("1 macros");
  });

  it("shows error state", () => {
    mockUseMacros.mockReturnValue({ data: undefined, isLoading: false, error: new Error("fail") });
    render(<ListMacros />);

    expect(screen.getByText("macros.errorLoading")).toBeInTheDocument();
  });

  it("updates search filter", async () => {
    const user = userEvent.setup();
    render(<ListMacros />);

    await user.type(screen.getByPlaceholderText("macros.searchPlaceholder"), "test");

    expect(mockUseMacros).toHaveBeenLastCalledWith(expect.objectContaining({ search: "test" }));
  });
});
