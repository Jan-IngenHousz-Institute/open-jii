import { PrincipalProvider } from "@/components/auth/principal-context";
import { render, screen, userEvent } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HomeNotice } from "./home-notice";

const { mockPublicMetrics } = vi.hoisted(() => ({ mockPublicMetrics: vi.fn() }));

vi.mock("@/hooks/metrics/usePublicMetrics/usePublicMetrics", () => ({
  usePublicMetrics: mockPublicMetrics,
}));

const withMilestone = {
  isPending: false,
  data: {
    captions: [
      { kind: "streak", days: 312 },
      { kind: "milestone", ordinal: 1_000_000, date: "2026-06-12" },
    ],
  },
};

const withoutMilestone = { isPending: false, data: { captions: [{ kind: "streak", days: 5 }] } };

describe("HomeNotice", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows a standing milestone first, then the welcome once it is dismissed", async () => {
    mockPublicMetrics.mockReturnValue(withMilestone);

    render(<HomeNotice locale="en-US" />);

    expect(screen.getByText("dashboard.milestone")).toBeInTheDocument();
    expect(screen.queryByText("dashboard.welcomeNotice")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "dashboard.dismiss" }));

    expect(screen.queryByText("dashboard.milestone")).not.toBeInTheDocument();
    expect(screen.getByText("dashboard.welcomeNotice")).toBeInTheDocument();
  });

  it("offers the transfer request from the welcome", () => {
    mockPublicMetrics.mockReturnValue(withoutMilestone);

    render(<HomeNotice locale="en-US" />);

    expect(screen.getByRole("link", { name: "dashboard.requestTransfer" })).toHaveAttribute(
      "href",
      "/en-US/platform/transfer-request",
    );
  });

  it("does not invite a guest to request a transfer", () => {
    mockPublicMetrics.mockReturnValue(withoutMilestone);

    const { container } = render(
      <PrincipalProvider userId="guest-1" isGuest>
        <HomeNotice locale="en-US" />
      </PrincipalProvider>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("remembers each dismissal on its own", async () => {
    mockPublicMetrics.mockReturnValue(withoutMilestone);
    const { unmount } = render(<HomeNotice locale="en-US" />);
    await userEvent.click(screen.getByRole("button", { name: "dashboard.dismiss" }));
    unmount();

    mockPublicMetrics.mockReturnValue(withMilestone);
    const { container } = render(<HomeNotice locale="en-US" />);

    expect(screen.getByText("dashboard.milestone")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "dashboard.dismiss" }));
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing while the metrics load, so the welcome never swaps for a milestone", () => {
    mockPublicMetrics.mockReturnValue({ isPending: true, data: undefined });

    const { container } = render(<HomeNotice locale="en-US" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("welcomes the reader when the metrics fail", () => {
    mockPublicMetrics.mockReturnValue({ isPending: false, data: undefined });

    render(<HomeNotice locale="en-US" />);

    expect(screen.getByText("dashboard.welcomeNotice")).toBeInTheDocument();
  });
});
