import { render, screen, userEvent } from "@/test/test-utils";
import { usePostHog } from "posthog-js/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { setConsentStatus } from "~/lib/cookie-consent";

import { toast } from "@repo/ui/hooks";

import CookieSettingsPage from "./page";

let mockConsentStatus = "pending";
vi.mock("~/lib/cookie-consent", () => ({
  getConsentStatus: () => mockConsentStatus,
  setConsentStatus: vi.fn((s: string) => {
    mockConsentStatus = s;
  }),
}));

describe("CookieSettingsPage", () => {
  let posthog: ReturnType<typeof usePostHog>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsentStatus = "pending";
    posthog = {
      opt_in_capturing: vi.fn(),
      opt_out_capturing: vi.fn(),
      reset: vi.fn(),
      capture: vi.fn(),
    };
    vi.mocked(usePostHog).mockReturnValue(posthog);
  });

  it("renders page title and cookie cards", () => {
    render(<CookieSettingsPage />);
    expect(screen.getByText("cookieSettings.title")).toBeInTheDocument();
    expect(screen.getByText("cookieSettings.essentialTitle")).toBeInTheDocument();
    expect(screen.getByText("cookieSettings.analyticsTitle")).toBeInTheDocument();
  });

  it("shows enabled status when consent is accepted", () => {
    mockConsentStatus = "accepted";
    render(<CookieSettingsPage />);
    expect(screen.getByText("cookieSettings.statusEnabled")).toBeInTheDocument();
    expect(screen.getByText("cookieSettings.disableAnalytics")).toBeInTheDocument();
  });

  it("shows disabled status when consent is rejected", () => {
    mockConsentStatus = "rejected";
    render(<CookieSettingsPage />);
    expect(screen.getByText("cookieSettings.statusDisabled")).toBeInTheDocument();
    expect(screen.getByText("cookieSettings.enableAnalytics")).toBeInTheDocument();
  });

  it("enables analytics when toggling from rejected", async () => {
    const user = userEvent.setup();
    mockConsentStatus = "rejected";
    render(<CookieSettingsPage />);

    await user.click(screen.getByText("cookieSettings.enableAnalytics"));

    expect(posthog.opt_in_capturing).toHaveBeenCalled();
    expect(setConsentStatus).toHaveBeenCalledWith("accepted");
    expect(toast).toHaveBeenCalledWith({ description: "cookieSettings.analyticsEnabledToast" });
  });

  it("disables analytics when toggling from accepted", async () => {
    const user = userEvent.setup();
    mockConsentStatus = "accepted";
    render(<CookieSettingsPage />);

    await user.click(screen.getByText("cookieSettings.disableAnalytics"));

    expect(posthog.opt_out_capturing).toHaveBeenCalled();
    expect(posthog.reset).toHaveBeenCalled();
    expect(setConsentStatus).toHaveBeenCalledWith("rejected");
    expect(toast).toHaveBeenCalledWith({ description: "cookieSettings.analyticsDisabledToast" });
  });
});
