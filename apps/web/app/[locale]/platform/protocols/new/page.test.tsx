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
  NewProtocolForm: () => <div data-testid="new-protocol-form">New Protocol Form</div>,
}));

describe("NewProtocolPage", () => {
  it("renders the new protocol form", () => {
    render(<NewProtocolPage />);

    expect(screen.getByTestId("new-protocol-form")).toBeInTheDocument();
  });
});
