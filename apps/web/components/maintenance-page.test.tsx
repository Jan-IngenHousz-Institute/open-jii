import { render, screen } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { MaintenancePage } from "./maintenance-page";

describe("MaintenancePage", () => {
  it("renders the maintenance message and a link home", () => {
    render(<MaintenancePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/we'll be back soon/i);
    expect(screen.getByText(/performing maintenance/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /openjii/i })).toHaveAttribute("href", "/");
  });
});
