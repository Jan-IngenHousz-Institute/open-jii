import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import posthog from "posthog-js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { setAnalyticsConsent } from "~/lib/cookie-consent";

import { CookieBanner } from "./cookie-banner";

let mockConsentStatus = "pending";
vi.mock("~/lib/cookie-consent", () => ({
  getConsentStatus: () => mockConsentStatus,
  setAnalyticsConsent: vi.fn((_posthog: unknown, s: string) => {
    mockConsentStatus = s;
  }),
}));

describe("CookieBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsentStatus = "pending";
  });

  it("shows the banner when consent is pending", () => {
    render(<CookieBanner />);
    expect(screen.getByText("cookieBanner.intro", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cookieBanner.acceptAll/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cookieBanner.rejectAll/i })).toBeInTheDocument();
  });

  it("hides the banner when already consented", () => {
    mockConsentStatus = "accepted";
    render(<CookieBanner />);
    expect(screen.queryByText("cookieBanner.intro", { exact: false })).not.toBeInTheDocument();
  });

  it("persists consent on accept", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);
    await user.click(screen.getByRole("button", { name: /cookieBanner.acceptAll/i }));
    expect(setAnalyticsConsent).toHaveBeenCalledWith(posthog, "accepted");
    expect(screen.queryByText("cookieBanner.intro", { exact: false })).not.toBeInTheDocument();
  });

  it("persists rejection on reject", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);
    await user.click(screen.getByRole("button", { name: /cookieBanner.rejectAll/i }));
    expect(setAnalyticsConsent).toHaveBeenCalledWith(posthog, "rejected");
  });

  it("opens preferences dialog and saves analytics choice", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);
    await user.click(screen.getByRole("button", { name: /cookieBanner.managePreferences/i }));
    await waitFor(() => expect(screen.getByText("cookieBanner.dialogTitle")).toBeInTheDocument());

    await user.click(screen.getByRole("switch"));
    await user.click(screen.getByRole("button", { name: /cookieBanner.saveClose/i }));
    expect(setAnalyticsConsent).toHaveBeenCalledWith(posthog, "accepted");
  });

  it("saves rejection when analytics left disabled in preferences", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);
    await user.click(screen.getByRole("button", { name: /cookieBanner.managePreferences/i }));
    await waitFor(() => expect(screen.getByText("cookieBanner.dialogTitle")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /cookieBanner.saveClose/i }));
    expect(setAnalyticsConsent).toHaveBeenCalledWith(posthog, "rejected");
  });
});
