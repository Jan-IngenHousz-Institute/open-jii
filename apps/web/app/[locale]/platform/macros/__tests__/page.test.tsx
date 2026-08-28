import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import Page from "../page";

vi.mock("@/components/list-macros", () => ({
  ListMacros: () => <div data-testid="list-macros" />,
}));

describe("MacroPage", () => {
  it("does not repeat the shell heading", () => {
    render(<Page />);
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("renders the macro list component", () => {
    render(<Page />);
    expect(screen.getByTestId("list-macros")).toBeInTheDocument();
  });
});
