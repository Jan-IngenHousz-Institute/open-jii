import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import Page from "../page";

vi.mock("@/components/list-macros", () => ({
  ListMacros: () => <div data-testid="list-macros" />,
}));

describe("MacroPage", () => {
  it("renders heading, description, and create button", async () => {
    render(await Page({ params: Promise.resolve({ locale: "en-US" }) }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("macros.title");
    expect(screen.getByText("macros.listDescription")).toBeInTheDocument();
    expect(screen.getByText("macros.create")).toBeInTheDocument();
  });

  it("should render the create macro button with correct link", async () => {
    const result = await MacroPage({ params: mockParams });
    render(result);

    const link = screen.getByTestId("link");
    expect(link).toHaveAttribute("href", "/platform/macros/new");
    expect(link).toHaveAttribute("data-locale", "en-US");

    const button = screen.getByTestId("button");
    expect(button).not.toHaveAttribute("data-variant");
    expect(button).toHaveTextContent("Create New Macro");
  });

  it("should render the ListMacros component", async () => {
    const result = await MacroPage({ params: mockParams });
    render(result);

    expect(screen.getByTestId("list-macros")).toBeInTheDocument();
  });
});
