import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import NewCommandPage from "./page";

vi.mock("@/components/new-command/new-command", () => ({
  NewCommandForm: () => <div data-testid="new-command-form">New Command Form</div>,
}));

describe("NewCommandPage", () => {
  it("renders the new command form", () => {
    render(<NewCommandPage />);

    expect(screen.getByTestId("new-command-form")).toBeInTheDocument();
  });
});
