import { render, screen, userEvent } from "@/test/test-utils";
import posthog from "posthog-js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { setAnalyticsConsent } from "~/lib/cookie-consent";

import { toast } from "@repo/ui/hooks/use-toast";

import CookieSettingsPage from "./page";

let mockConsentStatus = "pending";
vi.mock("~/lib/cookie-consent", () => ({
  getConsentStatus: () => mockConsentStatus,
  setAnalyticsConsent: vi.fn((_posthog: unknown, s: string) => {
    mockConsentStatus = s;
  }),
}));

describe("CookieSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsentStatus = "pending";
  });

  it("renders page title and cookie cards", () => {
    render(<CookieSettingsPage />);
    expect(screen.getByText("cookieSettings.title")).toBeInTheDocument();
    expect(screen.getByText("cookieSettings.essentialTitle")).toBeInTheDocument();
    expect(screen.getByText("cookieSettings.analyticsTitle")).toBeInTheDocument();
  });

  it("says what feature checks send to PostHog under the essential cookies", () => {
    render(<CookieSettingsPage />);
    expect(screen.getByText("cookieSettings.essentialFeatureChecksText")).toBeInTheDocument();
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

    expect(setAnalyticsConsent).toHaveBeenCalledWith(posthog, "accepted");
    expect(toast).toHaveBeenCalledWith({ description: "cookieSettings.analyticsEnabledToast" });
  });

  it("disables analytics when toggling from accepted", async () => {
    const user = userEvent.setup();
    mockConsentStatus = "accepted";
    render(<CookieSettingsPage />);

    await user.click(screen.getByText("cookieSettings.disableAnalytics"));

    expect(setAnalyticsConsent).toHaveBeenCalledWith(posthog, "rejected");
    expect(toast).toHaveBeenCalledWith({ description: "cookieSettings.analyticsDisabledToast" });
  });
});
