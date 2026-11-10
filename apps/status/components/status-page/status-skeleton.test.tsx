import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "~/test/test-utils";

import { StatusSkeleton } from "./status-skeleton";

describe("StatusSkeleton", () => {
  it("tells a screen reader the status is loading", () => {
    renderWithProviders(<StatusSkeleton />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading the current status");
  });

  it("shows a slow-network note that fades in after ten seconds by CSS alone", () => {
    renderWithProviders(<StatusSkeleton />);

    const note = screen.getByText(
      "This is taking longer than usual, which often means a slow or dropped connection.",
    );

    expect(note).toHaveClass("animate-in", "fade-in", "fill-mode-both", "delay-[10s]");
    expect(note).toHaveAttribute("aria-hidden", "true");
  });

  it("pulses only for people who have not asked for less motion", () => {
    const { container } = renderWithProviders(<StatusSkeleton />);
    const blocks = container.querySelectorAll(".bg-accent");

    expect(blocks).toHaveLength(4);
    for (const block of blocks) {
      expect(block).toHaveClass("motion-safe:animate-pulse", "animate-none");
      expect(block).not.toHaveClass("animate-pulse");
    }
  });
});
