import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { toast } from "@repo/ui/hooks";

import CookieSettingsPage from "./page";

// --- Mocks (all hoisted since they're used in vi.mock factories) ---
const { mockOptIn, mockOptOut, mockReset, mockGetConsent, mockSetConsent } = vi.hoisted(() => ({
  mockOptIn: vi.fn(),
  mockOptOut: vi.fn(),
  mockReset: vi.fn(),
  mockGetConsent: vi.fn(() => "pending"),
  mockSetConsent: vi.fn(),
}));

vi.mock("posthog-js/react", () => ({
  usePostHog: () => ({
    opt_in_capturing: mockOptIn,
    opt_out_capturing: mockOptOut,
    reset: mockReset,
  }),
}));

vi.mock("../../../../lib/cookie-consent", () => ({
  getConsentStatus: mockGetConsent,
  setConsentStatus: mockSetConsent,
}));

describe("CookieSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConsent.mockReturnValue("pending");
  });

  it("renders page title and cookie cards", () => {
    render(<CookieSettingsPage />);

    expect(screen.getByText("cookieSettings.title")).toBeInTheDocument();
    expect(screen.getByText("cookieSettings.essentialTitle")).toBeInTheDocument();
    expect(screen.getByText("cookieSettings.analyticsTitle")).toBeInTheDocument();
  });

  it("shows enabled status when consent is accepted", () => {
    mockGetConsent.mockReturnValue("accepted");
    render(<CookieSettingsPage />);

    expect(screen.getByText("cookieSettings.statusEnabled")).toBeInTheDocument();
    expect(screen.getByText("cookieSettings.disableAnalytics")).toBeInTheDocument();
  });

  it("shows disabled status when consent is rejected", () => {
    mockGetConsent.mockReturnValue("rejected");
    render(<CookieSettingsPage />);

    expect(screen.getByText("cookieSettings.statusDisabled")).toBeInTheDocument();
    expect(screen.getByText("cookieSettings.enableAnalytics")).toBeInTheDocument();
  });

  it("enables analytics when toggling from rejected", async () => {
    const user = userEvent.setup();
    mockGetConsent.mockReturnValue("rejected");
    render(<CookieSettingsPage />);

    await user.click(screen.getByText("cookieSettings.enableAnalytics"));

    expect(mockOptIn).toHaveBeenCalled();
    expect(mockSetConsent).toHaveBeenCalledWith("accepted");
    expect(toast).toHaveBeenCalledWith({
      description: "cookieSettings.analyticsEnabledToast",
    });
  });

  it("disables analytics when toggling from accepted", async () => {
    const user = userEvent.setup();
    mockGetConsent.mockReturnValue("accepted");
    render(<CookieSettingsPage />);

    await user.click(screen.getByText("cookieSettings.disableAnalytics"));

    expect(mockOptOut).toHaveBeenCalled();
    expect(mockReset).toHaveBeenCalled();
    expect(mockSetConsent).toHaveBeenCalledWith("rejected");
    expect(toast).toHaveBeenCalledWith({
      description: "cookieSettings.analyticsDisabledToast",
    });
  });
});
