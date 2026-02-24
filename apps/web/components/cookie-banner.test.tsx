/**
 * CookieBanner component test — renders with real @repo/ui components
 * (Button, Dialog, Switch). Only mocks the cookie-consent storage
 * module which is a thin wrapper around document.cookie.
 *
 * PostHog and i18n are globally mocked in test/setup.ts.
 *
 * Uses `userEvent` for realistic interactions instead of `fireEvent`.
 */
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { CookieBanner } from "./cookie-banner";

// ── Only mock the cookie storage layer ──────────────────────────
let mockConsentStatus = "pending";
vi.mock("~/lib/cookie-consent", () => ({
  getConsentStatus: () => mockConsentStatus,
  setConsentStatus: vi.fn((status: string) => {
    mockConsentStatus = status;
  }),
}));

// Import the mock after vi.mock so we can assert on it
const { setConsentStatus } = await import("~/lib/cookie-consent");

describe("<CookieBanner />", () => {
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

  it("hides the banner when the user has already consented", () => {
    mockConsentStatus = "accepted";
    render(<CookieBanner />);

    expect(screen.queryByText("cookieBanner.intro", { exact: false })).not.toBeInTheDocument();
  });

  it("persists consent and opts into posthog when user clicks accept", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);

    await user.click(screen.getByRole("button", { name: /cookieBanner.acceptAll/i }));

    expect(setConsentStatus).toHaveBeenCalledWith("accepted");
    // Banner should disappear after accepting
    expect(screen.queryByText("cookieBanner.intro", { exact: false })).not.toBeInTheDocument();
  });

  it("persists rejection and resets posthog when user clicks reject", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);

    await user.click(screen.getByRole("button", { name: /cookieBanner.rejectAll/i }));

    expect(setConsentStatus).toHaveBeenCalledWith("rejected");
    expect(screen.queryByText("cookieBanner.intro", { exact: false })).not.toBeInTheDocument();
  });

  it("opens a preferences dialog and lets the user toggle analytics", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);

    // Open the preferences dialog
    await user.click(screen.getByRole("button", { name: /cookieBanner.managePreferences/i }));

    // The dialog should appear with a title
    await waitFor(() => {
      expect(screen.getByText("cookieBanner.dialogTitle")).toBeInTheDocument();
    });

    // Find the analytics switch and toggle it on
    const analyticsSwitch = screen.getByRole("switch");
    await user.click(analyticsSwitch);

    // Save preferences — should accept because analytics is enabled
    await user.click(screen.getByRole("button", { name: /cookieBanner.saveClose/i }));

    expect(setConsentStatus).toHaveBeenCalledWith("accepted");
  });

  it("saves rejection when analytics is left disabled in preferences", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);

    // Open preferences
    await user.click(screen.getByRole("button", { name: /cookieBanner.managePreferences/i }));

    await waitFor(() => {
      expect(screen.getByText("cookieBanner.dialogTitle")).toBeInTheDocument();
    });

    // Don't toggle the switch — leave analytics off, then save
    await user.click(screen.getByRole("button", { name: /cookieBanner.saveClose/i }));

    expect(setConsentStatus).toHaveBeenCalledWith("rejected");
  });
});
