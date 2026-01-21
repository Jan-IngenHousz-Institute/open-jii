import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorContent } from "./error-content";

globalThis.React = React;

// Mock Next.js modules
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock i18n hook
const mockT = vi.fn((key: string) => key);
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: mockT,
  }),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  AlertCircle: ({ className }: { className?: string }) => (
    <div data-testid="alert-circle-icon" className={className}>
      AlertCircle
    </div>
  ),
}));

describe("ErrorContent", () => {
  const defaultProps = {
    locale: "en-US",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders error icon", () => {
    render(<ErrorContent {...defaultProps} />);

    const icon = screen.getByTestId("alert-circle-icon");
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass("h-12 w-12 text-red-500");
  });

  it("renders error title using translation", () => {
    render(<ErrorContent {...defaultProps} />);

    expect(mockT).toHaveBeenCalledWith("auth.errorTitle");
    expect(screen.getByText("auth.errorTitle")).toBeInTheDocument();
  });

  it("renders default error description when no errorDescription prop provided", () => {
    render(<ErrorContent {...defaultProps} />);

    expect(mockT).toHaveBeenCalledWith("auth.errorDescription");
    expect(screen.getByText("auth.errorDescription")).toBeInTheDocument();
  });

  it("renders custom error description when provided", () => {
    const customDescription = "Custom error message from OAuth provider";
    render(<ErrorContent {...defaultProps} errorDescription={customDescription} />);

    expect(screen.getByText(customDescription)).toBeInTheDocument();
    expect(screen.queryByText("auth.errorDescription")).not.toBeInTheDocument();
  });

  it("does not render error code when error prop is not provided", () => {
    render(<ErrorContent {...defaultProps} />);

    expect(screen.queryByText(/Error:/)).not.toBeInTheDocument();
  });

  it("renders error code when error prop is provided", () => {
    const errorCode = "oauth_error";
    render(<ErrorContent {...defaultProps} error={errorCode} />);

    expect(screen.getByText(`Error: ${errorCode}`)).toBeInTheDocument();
  });

  it("renders Try Again button with correct link", () => {
    render(<ErrorContent {...defaultProps} />);

    expect(mockT).toHaveBeenCalledWith("auth.errorTryAgain");
    const tryAgainLink = screen.getByRole("link", { name: "auth.errorTryAgain" });

    expect(tryAgainLink).toBeInTheDocument();
    expect(tryAgainLink).toHaveAttribute("href", "/en-US/login");

    expect(mockT).toHaveBeenCalledWith("auth.errorGoHome");
    const goHomeLink = screen.getByRole("link", { name: "auth.errorGoHome" });

    expect(goHomeLink).toBeInTheDocument();
    expect(goHomeLink).toHaveAttribute("href", "/en-US");

    expect(mockT).toHaveBeenCalledWith("auth.errorSupport");
    expect(screen.getByText("auth.errorSupport")).toBeInTheDocument();
  });

  it("renders with different locale", () => {
    render(<ErrorContent locale="de-DE" />);

    const tryAgainLink = screen.getByRole("link", { name: "auth.errorTryAgain" });
    const goHomeLink = screen.getByRole("link", { name: "auth.errorGoHome" });

    expect(tryAgainLink).toHaveAttribute("href", "/de-DE/login");
    expect(goHomeLink).toHaveAttribute("href", "/de-DE");
    render(<ErrorContent {...defaultProps} />);

    const expectedTranslationKeys = [
      "auth.errorTitle",
      "auth.errorDescription",
      "auth.errorTryAgain",
      "auth.errorGoHome",
      "auth.errorSupport",
    ];

    expectedTranslationKeys.forEach((key) => {
      expect(mockT).toHaveBeenCalledWith(key);
    });
  });

  it("renders with all props provided", () => {
    const errorCode = "verification_failed";
    const customDescription = "The verification link has expired";

    render(<ErrorContent locale="nl-NL" error={errorCode} errorDescription={customDescription} />);

    expect(screen.getByText(customDescription)).toBeInTheDocument();
    expect(screen.getByText(`Error: ${errorCode}`)).toBeInTheDocument();

    const tryAgainLink = screen.getByRole("link", { name: "auth.errorTryAgain" });
    const goHomeLink = screen.getByRole("link", { name: "auth.errorGoHome" });
    expect(tryAgainLink).toHaveAttribute("href", "/nl-NL/login");
    expect(goHomeLink).toHaveAttribute("href", "/nl-NL");
    const { container } = render(<ErrorContent {...defaultProps} />);

    const card = container.querySelector(".bg-card");
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass(
      "text-card-foreground",
      "ring-border",
      "min-h-[600px]",
      "rounded-2xl",
      "shadow-lg",
      "ring-1",
    );
  });

  it("renders buttons with correct styling", () => {
    render(<ErrorContent {...defaultProps} />);

    const tryAgainLink = screen.getByRole("link", { name: "auth.errorTryAgain" });
    const goHomeLink = screen.getByRole("link", { name: "auth.errorGoHome" });

    // Both buttons should have the same base styling
    expect(tryAgainLink).toHaveClass("h-12 w-full rounded-full");
    expect(goHomeLink).toHaveClass("h-12 w-full rounded-full");
  });
});
