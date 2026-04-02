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
  });
});
