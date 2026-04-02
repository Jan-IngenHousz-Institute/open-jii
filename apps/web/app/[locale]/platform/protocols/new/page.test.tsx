import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import NewProtocolPage from "./page";

vi.mock("@/components/new-protocol/new-protocol", () => ({
  NewProtocolForm: () => <div data-testid="new-protocol-form">New Protocol Form</div>,
}));

describe("NewProtocolPage", () => {
  it("renders the new protocol form", () => {
    render(<NewProtocolPage />);

    expect(screen.getByTestId("new-protocol-form")).toBeInTheDocument();
  });
});
