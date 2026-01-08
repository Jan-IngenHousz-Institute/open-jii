import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { CookieBanner } from "./cookie-banner";

globalThis.React = React;

// ---------- Mocks ----------
const mockOptIn = vi.fn();
const mockOptOut = vi.fn();
const mockReset = vi.fn();

vi.mock("posthog-js/react", () => ({
  usePostHog: () => ({
    opt_in_capturing: mockOptIn,
    opt_out_capturing: mockOptOut,
    reset: mockReset,
  }),
}));

vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@repo/ui/components", () => ({
  Button: ({
    children,
    onClick,
    variant,
  }: React.ComponentProps<"button"> & { variant?: string }) => (
    <button onClick={onClick} data-variant={variant}>
      {children}
    </button>
  ),
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  }) => (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      data-testid="analytics-switch"
    >
      {checked ? "on" : "off"}
    </button>
  ),
}));

let mockConsentStatus = "pending";
const mockGetConsentStatus = vi.fn(() => mockConsentStatus);
const mockSetConsentStatus = vi.fn();

vi.mock("~/lib/cookie-consent", () => ({
  getConsentStatus: () => mockGetConsentStatus(),
  setConsentStatus: (status: string) => {
    mockSetConsentStatus(status);
  },
}));

// ---------- Tests ----------
describe("<CookieBanner />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsentStatus = "pending";
  });

  it("renders banner when consent is pending", () => {
    render(<CookieBanner />);

    expect(screen.getByText("cookieBanner.intro")).toBeInTheDocument();
    expect(screen.getByText("cookieBanner.acceptAll")).toBeInTheDocument();
    expect(screen.getByText("cookieBanner.rejectAll")).toBeInTheDocument();
  });

  it("does not render when consent is already given", () => {
    mockConsentStatus = "accepted";
    render(<CookieBanner />);

    expect(screen.queryByText("cookieBanner.intro")).not.toBeInTheDocument();
  });

  it("handles accept cookies", () => {
    render(<CookieBanner />);

    const acceptButton = screen.getByText("cookieBanner.acceptAll");
    fireEvent.click(acceptButton);

    expect(mockSetConsentStatus).toHaveBeenCalledWith("accepted");
    expect(mockOptIn).toHaveBeenCalled();
  });

  it("handles reject cookies", () => {
    render(<CookieBanner />);

    const rejectButton = screen.getByText("cookieBanner.rejectAll");
    fireEvent.click(rejectButton);

    expect(mockSetConsentStatus).toHaveBeenCalledWith("rejected");
    expect(mockOptOut).toHaveBeenCalled();
    expect(mockReset).toHaveBeenCalled();
  });

  it("opens preferences dialog", () => {
    render(<CookieBanner />);

    const manageButton = screen.getByText("cookieBanner.managePreferences");
    fireEvent.click(manageButton);

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByText("cookieBanner.dialogTitle")).toBeInTheDocument();
  });

  it("saves preferences with analytics enabled", () => {
    render(<CookieBanner />);

    // Open dialog
    fireEvent.click(screen.getByText("cookieBanner.managePreferences"));

    // Enable analytics
    const analyticsSwitch = screen.getByTestId("analytics-switch");
    fireEvent.click(analyticsSwitch);

    // Save preferences
    const saveButton = screen.getByText("cookieBanner.saveClose");
    fireEvent.click(saveButton);

    expect(mockSetConsentStatus).toHaveBeenCalledWith("accepted");
    expect(mockOptIn).toHaveBeenCalled();
  });

  it("saves preferences with analytics disabled", () => {
    render(<CookieBanner />);

    // Open dialog
    fireEvent.click(screen.getByText("cookieBanner.managePreferences"));

    // Save preferences (analytics disabled by default)
    const saveButton = screen.getByText("cookieBanner.saveClose");
    fireEvent.click(saveButton);

    expect(mockSetConsentStatus).toHaveBeenCalledWith("rejected");
    expect(mockOptOut).toHaveBeenCalled();
    expect(mockReset).toHaveBeenCalled();
  });
});
