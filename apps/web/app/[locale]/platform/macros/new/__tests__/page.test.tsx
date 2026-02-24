import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/components/new-macro/new-macro", () => ({
  NewMacroForm: () => <div data-testid="new-macro-form" />,
}));

describe("NewMacroPage", () => {
  it("renders heading, description, and form", async () => {
    const { default: Page } = await import("../page");
    render(await Page({ params: Promise.resolve({ locale: "en-US" }) }));
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("macros.newMacro");
    expect(screen.getByText("newMacro.description")).toBeInTheDocument();
    expect(screen.getByTestId("new-macro-form")).toBeInTheDocument();
  });
});
