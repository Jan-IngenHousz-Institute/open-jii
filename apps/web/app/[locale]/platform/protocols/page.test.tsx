import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import Page from "./page";

vi.mock("@/components/list-protocols", () => ({
  ListProtocols: () => <div data-testid="list-protocols" />,
}));

describe("ProtocolPage", () => {
  it("does not repeat the shell heading", () => {
    render(<Page />);
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("renders the protocol list component", () => {
    render(<Page />);
    expect(screen.getByTestId("list-protocols")).toBeInTheDocument();
  });
});
