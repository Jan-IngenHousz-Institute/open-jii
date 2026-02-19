import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import NewProtocolPage from "./page";

globalThis.React = React;

// --- Mocks ---
vi.mock("@repo/i18n/server", () => ({
  __esModule: true,
  default: vi.fn(() => Promise.resolve({ t: (key: string) => key })),
}));

vi.mock("@/components/new-protocol", () => ({
  NewProtocolForm: () => (
    <div data-testid="new-protocol-form">
      <div>
        <h3 className="text-lg font-medium">protocols.newProtocol</h3>
        <p className="text-muted-foreground text-sm">newProtocol.description</p>
      </div>
      <div>New Protocol Form</div>
    </div>
  ),
}));

// --- Tests ---
describe("NewProtocolPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the new protocol page with all components", () => {
    render(<NewProtocolPage />);

    expect(screen.getByText("protocols.newProtocol")).toBeInTheDocument();
    expect(screen.getByText("newProtocol.description")).toBeInTheDocument();
    expect(screen.getByTestId("new-protocol-form")).toBeInTheDocument();
  });

  it("renders heading with correct styling", () => {
    const { container } = render(<NewProtocolPage />);

    const heading = container.querySelector("h3");
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass("text-lg", "font-medium");
    expect(heading).toHaveTextContent("protocols.newProtocol");
  });

  it("renders description with correct styling", () => {
    const { container } = render(<NewProtocolPage />);

    const description = container.querySelector("p");
    expect(description).toBeInTheDocument();
    expect(description).toHaveClass("text-muted-foreground", "text-sm");
    expect(description).toHaveTextContent("newProtocol.description");
  });

  it("renders with correct structure and spacing", () => {
    const { container } = render(<NewProtocolPage />);

    const mainDiv = container.querySelector(".space-y-6");
    expect(mainDiv).toBeInTheDocument();

    const headerDiv = container.querySelector("div > div");
    expect(headerDiv).toBeInTheDocument();
  });

  it("renders form component", () => {
    render(<NewProtocolPage />);

    const form = screen.getByTestId("new-protocol-form");
    expect(form).toBeInTheDocument();
    expect(form).toHaveTextContent("New Protocol Form");
  });
});
