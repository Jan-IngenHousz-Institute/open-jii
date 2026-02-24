import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/components/list-macros", () => ({
  ListMacros: () => <div data-testid="list-macros" />,
}));

describe("MacroPage", () => {
  it("renders heading, description, and create button", async () => {
    const { default: Page } = await import("../page");
    render(await Page({ params: Promise.resolve({ locale: "en-US" }) }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("macros.title");
    expect(screen.getByText("macros.listDescription")).toBeInTheDocument();
    expect(screen.getByText("macros.create")).toBeInTheDocument();
  });

  it("renders the macro list component", async () => {
    const { default: Page } = await import("../page");
    render(await Page({ params: Promise.resolve({ locale: "en-US" }) }));
    expect(screen.getByTestId("list-macros")).toBeInTheDocument();
  });
});
