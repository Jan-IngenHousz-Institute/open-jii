import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

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
