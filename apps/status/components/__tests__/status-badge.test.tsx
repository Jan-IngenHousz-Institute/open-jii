import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithTranslations } from "~/test/render-status";

import { StatusBadge } from "../status-badge";

describe("StatusBadge", () => {
  it("shows a wrench and the maintenance colour for a component under maintenance", () => {
    renderWithTranslations(<StatusBadge state="maintenance" />);

    const badge = screen.getByText("Maintenance");

    expect(badge).toHaveClass("bg-status-published", "text-status-published-foreground");
    expect(badge.querySelector("svg")).toHaveClass("lucide-wrench");
  });

  it("uses the same colour as the planned work badges", () => {
    renderWithTranslations(<StatusBadge state="in-progress" />);

    expect(screen.getByText("In progress")).toHaveClass("bg-status-published");
  });

  it("keeps the state's text and icon but drops its colour when muted", () => {
    renderWithTranslations(<StatusBadge state="operational" isMuted />);

    const badge = screen.getByText("Operational");

    expect(badge).toHaveClass("bg-status-archived", "text-status-archived-foreground");
    expect(badge).not.toHaveClass("bg-status-active");
    expect(badge.querySelector("svg")).toHaveClass("lucide-circle-check");
  });

  it("is in colour unless muted", () => {
    renderWithTranslations(<StatusBadge state="outage" />);

    expect(screen.getByText("Outage")).toHaveClass("bg-destructive");
  });
});
