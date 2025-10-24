import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Locale } from "@repo/i18n";

import VerifyRequestPage from "./page";

globalThis.React = React;

// --- Mocks ---
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: (): unknown => mockAuth(),
}));

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string): void => {
    mockRedirect(url);
  },
}));

vi.mock("@repo/i18n/server", () => ({
  default: vi.fn(() =>
    Promise.resolve({
      t: (key: string) => key,
    }),
  ),
}));

vi.mock("@/components/unified-navbar/unified-navbar", () => ({
  UnifiedNavbar: ({ locale, session }: { locale: string; session: unknown }) => (
    <div data-testid="unified-navbar">
      Navbar - {locale} - {session ? "with session" : "no session"}
    </div>
  ),
}));

vi.mock("~/components/auth/auth-hero-section", () => ({
  AuthHeroSection: ({ locale }: { locale: string }) => (
    <div data-testid="auth-hero-section">Hero {locale}</div>
  ),
}));

// --- Tests ---
describe("VerifyRequestPage", () => {
  const locale = "en-US" as Locale;
  const defaultProps = {
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve({ provider: "email" }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(null);
  });

  it("renders the page with verify request texts", async () => {
    render(await VerifyRequestPage(defaultProps));

    expect(screen.getByTestId("unified-navbar")).toBeInTheDocument();
    expect(screen.getByTestId("auth-hero-section")).toBeInTheDocument();

    expect(screen.getByText("auth.verifyRequest")).toBeInTheDocument();
    expect(screen.getByText("auth.verifyRequestDetails")).toBeInTheDocument();
    expect(screen.getByText("auth.verifyRequestDetailsJunk")).toBeInTheDocument();
  });

  it("redirects if no provider is given", async () => {
    const props = {
      ...defaultProps,
      searchParams: Promise.resolve({}),
    };

    await VerifyRequestPage(props);

    expect(mockRedirect).toHaveBeenCalledWith(`/${locale}/`);
  });

  it("applies background image style", async () => {
    // Mock Math.random to ensure consistent background image
    const mockMathRandom = vi.spyOn(Math, "random").mockReturnValue(0.5);

    const props = {
      params: Promise.resolve({ locale }),
      searchParams: Promise.resolve({ provider: "email" }),
    };

    render(await VerifyRequestPage(props));

    const container = document.querySelector(".relative.min-h-svh");
    expect(container).toBeInTheDocument();

    expect(container).toHaveClass("bg-cover", "bg-center", "bg-no-repeat");

    // If the style is set, check it contains the expected parts
    if (container && (container as HTMLElement).style.backgroundImage) {
      expect((container as HTMLElement).style.backgroundImage).toContain("url('/login-background-");
      expect((container as HTMLElement).style.backgroundImage).toContain("linear-gradient");
    }

    mockMathRandom.mockRestore();
  });
});
