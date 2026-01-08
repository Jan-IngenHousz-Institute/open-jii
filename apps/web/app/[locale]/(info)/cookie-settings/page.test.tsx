import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import CookieSettingsPage from "./page";

globalThis.React = React;

// --- Hoisted Mocks ---
const mockOptInCapturing = vi.hoisted(() => vi.fn());
const mockOptOutCapturing = vi.hoisted(() => vi.fn());
const mockReset = vi.hoisted(() => vi.fn());
const mockToast = vi.hoisted(() => vi.fn());
const mockGetConsentStatus = vi.hoisted(() => vi.fn());
const mockSetConsentStatus = vi.hoisted(() => vi.fn());

// Mock PostHog
vi.mock("posthog-js/react", () => ({
  usePostHog: () => ({
    opt_in_capturing: mockOptInCapturing,
    opt_out_capturing: mockOptOutCapturing,
    reset: mockReset,
  }),
}));

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock toast
vi.mock("@repo/ui/hooks", () => ({
  toast: mockToast,
}));

// Mock cookie consent functions
vi.mock("../../../../lib/cookie-consent", () => ({
  getConsentStatus: mockGetConsentStatus,
  setConsentStatus: mockSetConsentStatus,
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick} data-testid="button">
      {children}
    </button>
  ),
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
}));

describe("CookieSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render the page title and intro", () => {
      mockGetConsentStatus.mockReturnValue("pending");

      render(<CookieSettingsPage />);

      expect(screen.getByText("cookieSettings.title")).toBeInTheDocument();
      expect(screen.getByText("cookieSettings.intro")).toBeInTheDocument();
    });

    it("should render essential cookies card", () => {
      mockGetConsentStatus.mockReturnValue("pending");

      render(<CookieSettingsPage />);

      expect(screen.getByText("cookieSettings.essentialTitle")).toBeInTheDocument();
      expect(screen.getByText("cookieSettings.essentialDescription")).toBeInTheDocument();
      expect(screen.getByText("cookieSettings.essentialPurpose")).toBeInTheDocument();
      expect(screen.getByText("cookieSettings.essentialPurposeText")).toBeInTheDocument();
      expect(screen.getByText("cookieSettings.essentialExamples")).toBeInTheDocument();
      expect(screen.getByText("cookieSettings.essentialExamplesText")).toBeInTheDocument();
      expect(screen.getByText("cookieSettings.essentialStatus")).toBeInTheDocument();
    });

    it("should render analytics cookies card", () => {
      mockGetConsentStatus.mockReturnValue("pending");

      render(<CookieSettingsPage />);

      expect(screen.getByText("cookieSettings.analyticsTitle")).toBeInTheDocument();
      expect(screen.getByText("cookieSettings.analyticsDescription")).toBeInTheDocument();
      expect(screen.getByText("cookieSettings.analyticsPurposeLabel")).toBeInTheDocument();
      expect(screen.getByText("cookieSettings.analyticsPurposeText")).toBeInTheDocument();
      expect(screen.getByText("cookieSettings.analyticsProviderLabel")).toBeInTheDocument();
      expect(screen.getByText("cookieSettings.analyticsProviderText")).toBeInTheDocument();
    });
  });

  describe("Consent Status Display", () => {
    it("should display 'Enabled' status when consent is accepted", () => {
      mockGetConsentStatus.mockReturnValue("accepted");

      render(<CookieSettingsPage />);

      expect(screen.getByText("cookieSettings.statusEnabled")).toBeInTheDocument();
    });

    it("should display 'Disabled' status when consent is rejected", () => {
      mockGetConsentStatus.mockReturnValue("rejected");

      render(<CookieSettingsPage />);

      expect(screen.getByText("cookieSettings.statusDisabled")).toBeInTheDocument();
    });

    it("should display 'Not Set' status when consent is pending", () => {
      mockGetConsentStatus.mockReturnValue("pending");

      render(<CookieSettingsPage />);

      expect(screen.getByText("cookieSettings.statusNotSet")).toBeInTheDocument();
    });
  });

  describe("Toggle Analytics Button", () => {
    it("should show 'Disable Analytics' button when consent is accepted", () => {
      mockGetConsentStatus.mockReturnValue("accepted");

      render(<CookieSettingsPage />);

      expect(screen.getByText("cookieSettings.disableAnalytics")).toBeInTheDocument();
    });

    it("should show 'Enable Analytics' button when consent is rejected", () => {
      mockGetConsentStatus.mockReturnValue("rejected");

      render(<CookieSettingsPage />);

      expect(screen.getByText("cookieSettings.enableAnalytics")).toBeInTheDocument();
    });

    it("should show 'Enable Analytics' button when consent is pending", () => {
      mockGetConsentStatus.mockReturnValue("pending");

      render(<CookieSettingsPage />);

      expect(screen.getByText("cookieSettings.enableAnalytics")).toBeInTheDocument();
    });
  });

  describe("Analytics Toggle Functionality", () => {
    it("should disable analytics when toggling from accepted", async () => {
      mockGetConsentStatus.mockReturnValue("accepted");

      render(<CookieSettingsPage />);

      const button = screen.getByText("cookieSettings.disableAnalytics");
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockOptOutCapturing).toHaveBeenCalledTimes(1);
        expect(mockReset).toHaveBeenCalledTimes(1);
        expect(mockSetConsentStatus).toHaveBeenCalledWith("rejected");
        expect(mockToast).toHaveBeenCalledWith({
          description: "cookieSettings.analyticsDisabledToast",
        });
      });
    });

    it("should enable analytics when toggling from rejected", async () => {
      mockGetConsentStatus.mockReturnValue("rejected");

      render(<CookieSettingsPage />);

      const button = screen.getByText("cookieSettings.enableAnalytics");
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockOptInCapturing).toHaveBeenCalledTimes(1);
        expect(mockSetConsentStatus).toHaveBeenCalledWith("accepted");
        expect(mockToast).toHaveBeenCalledWith({
          description: "cookieSettings.analyticsEnabledToast",
        });
      });
    });

    it("should enable analytics when toggling from pending", async () => {
      mockGetConsentStatus.mockReturnValue("pending");

      render(<CookieSettingsPage />);

      const button = screen.getByText("cookieSettings.enableAnalytics");
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockOptInCapturing).toHaveBeenCalledTimes(1);
        expect(mockSetConsentStatus).toHaveBeenCalledWith("accepted");
        expect(mockToast).toHaveBeenCalledWith({
          description: "cookieSettings.analyticsEnabledToast",
        });
      });
    });

    it("should not call reset when enabling analytics", async () => {
      mockGetConsentStatus.mockReturnValue("rejected");

      render(<CookieSettingsPage />);

      const button = screen.getByText("cookieSettings.enableAnalytics");
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockReset).not.toHaveBeenCalled();
      });
    });
  });

  describe("Page Structure", () => {
    it("should render with correct layout classes", () => {
      mockGetConsentStatus.mockReturnValue("pending");

      const { container } = render(<CookieSettingsPage />);

      const mainDiv = container.querySelector(".min-h-screen");
      expect(mainDiv).toBeInTheDocument();
    });

    it("should render background skew element", () => {
      mockGetConsentStatus.mockReturnValue("pending");

      const { container } = render(<CookieSettingsPage />);

      const skewDiv = container.querySelector('[aria-hidden="true"]');
      expect(skewDiv).toBeInTheDocument();
    });

    it("should have proper spacing between cards", () => {
      mockGetConsentStatus.mockReturnValue("pending");

      const { container } = render(<CookieSettingsPage />);

      const cardsContainer = container.querySelector(".space-y-8");
      expect(cardsContainer).toBeInTheDocument();
    });
  });

  describe("getConsentStatus Integration", () => {
    it("should call getConsentStatus on initial render", () => {
      mockGetConsentStatus.mockReturnValue("pending");

      render(<CookieSettingsPage />);

      expect(mockGetConsentStatus).toHaveBeenCalled();
    });

    it("should handle different consent status values", () => {
      const statuses = ["accepted", "rejected", "pending"] as const;

      statuses.forEach((status) => {
        vi.clearAllMocks();
        mockGetConsentStatus.mockReturnValue(status);

        const { unmount } = render(<CookieSettingsPage />);

        expect(mockGetConsentStatus).toHaveBeenCalled();

        unmount();
      });
    });
  });
});
