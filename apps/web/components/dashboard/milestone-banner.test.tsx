import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { MilestoneBanner } from "./milestone-banner";

const { mockPublicMetrics } = vi.hoisted(() => ({ mockPublicMetrics: vi.fn() }));

vi.mock("@/hooks/metrics/usePublicMetrics/usePublicMetrics", () => ({
  usePublicMetrics: mockPublicMetrics,
}));

describe("MilestoneBanner", () => {
  it("announces a standing milestone and dismisses on click", async () => {
    mockPublicMetrics.mockReturnValue({
      data: {
        captions: [
          { kind: "streak", days: 312 },
          { kind: "milestone", ordinal: 1_000_000, date: "2026-06-12" },
        ],
      },
    });

    render(<MilestoneBanner locale="en-US" />);

    expect(screen.getByText("dashboard.milestone")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "dashboard.dismiss" }));
    expect(screen.queryByText("dashboard.milestone")).not.toBeInTheDocument();
  });

  it("renders nothing without a milestone caption", () => {
    mockPublicMetrics.mockReturnValue({ data: { captions: [{ kind: "streak", days: 5 }] } });

    const { container } = render(<MilestoneBanner locale="en-US" />);

    expect(container).toBeEmptyDOMElement();
  });
});
