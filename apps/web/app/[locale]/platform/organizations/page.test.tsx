import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import OrganizationsPage from "./page";

vi.mock("./organizations-list-content", () => ({
  default: () => <div data-testid="organizations-list" />,
}));

describe("OrganizationsPage", () => {
  it("renders the list without repeating the shell heading or subtitle", () => {
    render(<OrganizationsPage />);

    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByText("organizations.listDescription")).not.toBeInTheDocument();
    expect(screen.getByTestId("organizations-list")).toBeInTheDocument();
  });
});
