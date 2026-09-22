import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { StatusTone } from "../status-badge";
import { StatusBadge } from "../status-badge";

const TONE_CLASSES: Record<StatusTone, [fill: string, foreground: string]> = {
  active: ["bg-status-active", "text-status-active-foreground"],
  stale: ["bg-status-stale", "text-status-stale-foreground"],
  archived: ["bg-status-archived", "text-status-archived-foreground"],
  published: ["bg-status-published", "text-status-published-foreground"],
  featured: ["bg-status-featured", "text-status-featured-foreground"],
  destructive: ["bg-destructive", "text-destructive-foreground"],
};

describe("StatusBadge", () => {
  it.each(Object.entries(TONE_CLASSES))(
    "pairs the %s fill with its own foreground",
    (tone, [fill, foreground]) => {
      const { container } = render(
        <StatusBadge tone={tone as StatusTone}>{tone} label</StatusBadge>,
      );

      const badge = container.firstElementChild;
      expect(badge).toHaveClass(fill, foreground);
    },
  );

  it("renders its children as the label", () => {
    render(<StatusBadge tone="active">Running</StatusBadge>);
    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("keeps a caller class alongside the tone", () => {
    const { container } = render(
      <StatusBadge tone="stale" className="capitalize">
        pending
      </StatusBadge>,
    );

    expect(container.firstElementChild).toHaveClass("capitalize", "bg-status-stale");
  });
});
