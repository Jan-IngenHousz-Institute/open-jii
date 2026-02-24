import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/components/list-protocols", () => ({
  ListProtocols: () => <div data-testid="list-protocols" />,
}));

describe("ProtocolPage", () => {
  it("renders heading, description, and create button", async () => {
    const { default: Page } = await import("./page");
    render(await Page({ params: Promise.resolve({ locale: "en-US" }) }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("protocols.title");
    expect(screen.getByText("protocols.listDescription")).toBeInTheDocument();
    expect(screen.getByText("protocols.create")).toBeInTheDocument();
  });

  it("renders the protocol list component", async () => {
    const { default: Page } = await import("./page");
    render(await Page({ params: Promise.resolve({ locale: "en-US" }) }));
    expect(screen.getByTestId("list-protocols")).toBeInTheDocument();
  });
});
