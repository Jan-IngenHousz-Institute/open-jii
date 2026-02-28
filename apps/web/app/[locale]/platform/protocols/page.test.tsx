import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import Page from "./page";

vi.mock("@/components/list-protocols", () => ({
  ListProtocols: () => <div data-testid="list-protocols" />,
}));

describe("ProtocolPage", () => {
  it("renders heading, description, and create button", async () => {
    render(await Page({ params: Promise.resolve({ locale: "en-US" }) }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("protocols.title");
    expect(screen.getByText("protocols.listDescription")).toBeInTheDocument();
    expect(screen.getByText("protocols.create")).toBeInTheDocument();
  });

  it("renders the protocol list component", async () => {
    render(await Page({ params: Promise.resolve({ locale: "en-US" }) }));
    expect(screen.getByTestId("list-protocols")).toBeInTheDocument();
    expect(screen.getByTestId("button")).toBeInTheDocument();
    expect(screen.getByTestId("link")).toBeInTheDocument();
  });

  it("renders the create new protocol button with correct text and variant", async () => {
    render(await ProtocolPage(defaultProps));

    const button = screen.getByTestId("button");
    expect(button).toHaveTextContent("protocols.create");
    expect(button).not.toHaveAttribute("data-variant");
  });

  it("renders create protocol link with correct href and locale", async () => {
    render(await ProtocolPage(defaultProps));

    const link = screen.getByTestId("link");
    expect(link).toHaveAttribute("href", "/platform/protocols/new");
    expect(link).toHaveAttribute("data-locale", "en-US");
  });

  it("renders heading with correct styling", async () => {
    const { container } = render(await ProtocolPage(defaultProps));

    const heading = container.querySelector("h1");
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent("protocols.title");
  });

  it("renders description with correct styling", async () => {
    const { container } = render(await ProtocolPage(defaultProps));

    const description = container.querySelector("p");
    expect(description).toBeInTheDocument();
    expect(description).toHaveTextContent("protocols.listDescription");
  });

  it("renders with correct structure and spacing", async () => {
    const { container } = render(await ProtocolPage(defaultProps));

    const mainDiv = container.querySelector(".space-y-6");
    expect(mainDiv).toBeInTheDocument();

    const headerDiv = container.querySelector("div > div");
    expect(headerDiv).toBeInTheDocument();
  });

  it("handles different locale", async () => {
    const germanProps = {
      params: Promise.resolve({ locale: "de" }),
    };

    render(await ProtocolPage(germanProps));

    const link = screen.getByTestId("link");
    expect(link).toHaveAttribute("data-locale", "de");
  });
});
