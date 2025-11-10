import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import ProtocolPage from "./page";

globalThis.React = React;

// --- Mocks ---
vi.mock("@repo/i18n/server", () => ({
  __esModule: true,
  default: vi.fn(() => Promise.resolve({ t: (key: string) => key })),
}));

vi.mock("@/components/list-protocols", () => ({
  ListProtocols: () => <div data-testid="list-protocols">List of Protocols</div>,
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
    locale,
  }: {
    children: React.ReactNode;
    href: string;
    locale: string;
  }) => (
    <a href={href} data-testid="link" data-locale={locale}>
      {children}
    </a>
  ),
}));

vi.mock("@repo/ui/components", () => ({
  Button: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <button data-testid="button" data-variant={variant}>
      {children}
    </button>
  ),
}));

// --- Tests ---
describe("ProtocolPage", () => {
  const locale = "en-US";
  const defaultProps = {
    params: Promise.resolve({ locale }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the protocols page with all components", async () => {
    render(await ProtocolPage(defaultProps));

    expect(screen.getByText("protocols.title")).toBeInTheDocument();
    expect(screen.getByText("protocols.listDescription")).toBeInTheDocument();
    expect(screen.getByTestId("list-protocols")).toBeInTheDocument();
    expect(screen.getByTestId("button")).toBeInTheDocument();
    expect(screen.getByTestId("link")).toBeInTheDocument();
  });

  it("renders the create new protocol button with correct text and variant", async () => {
    render(await ProtocolPage(defaultProps));

    const button = screen.getByTestId("button");
    expect(button).toHaveTextContent("protocols.create");
    expect(button).toHaveAttribute("data-variant", "outline");
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
    expect(heading).toHaveClass("text-lg", "font-medium");
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
