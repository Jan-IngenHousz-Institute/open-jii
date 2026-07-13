import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import Page from "./page";

vi.mock("@/components/list-commands", () => ({
  ListCommands: () => <div data-testid="list-commands" />,
}));

describe("CommandPage", () => {
  it("renders heading, description, and create button", async () => {
    render(await Page({ params: Promise.resolve({ locale: "en-US" }) }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("commands.title");
    expect(screen.getByText("commands.listDescription")).toBeInTheDocument();
    expect(screen.getByText("commands.create")).toBeInTheDocument();
  });

  it("renders the command list component", async () => {
    render(await Page({ params: Promise.resolve({ locale: "en-US" }) }));
    expect(screen.getByTestId("list-commands")).toBeInTheDocument();
  });
});
