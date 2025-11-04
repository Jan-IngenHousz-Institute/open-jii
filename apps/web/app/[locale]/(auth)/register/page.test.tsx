import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Locale } from "@repo/i18n";

import UserRegistrationPage from "./page";

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
    throw new Error("NEXT_REDIRECT");
  },
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

vi.mock("~/components/auth/registration-form", () => ({
  RegistrationForm: ({ callbackUrl, termsData }: { callbackUrl?: string; termsData: unknown }) => (
    <div data-testid="registration-form">
      Registration form - {callbackUrl ?? "no callback"} - {termsData ? "with terms" : "no terms"}
    </div>
  ),
}));

vi.mock("~/components/auth/terms-and-conditions-dialog", () => ({
  TermsAndConditionsDialog: ({ locale }: { locale: string }) =>
    Promise.resolve({ locale, content: "Terms content" }),
}));

// --- Tests ---
describe("UserRegistrationPage", () => {
  const locale = "en-US" as Locale;
  const defaultProps = {
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve({}),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "123", registered: false } });
  });

  it("passes the correct locale to components", async () => {
    render(await UserRegistrationPage(defaultProps));

    expect(screen.getByTestId("unified-navbar")).toHaveTextContent("en-US");
    expect(screen.getByTestId("auth-hero-section")).toHaveTextContent("en-US");
  });

  it("passes callbackUrl to RegistrationForm when provided", async () => {
    const props = {
      ...defaultProps,
      searchParams: Promise.resolve({ callbackUrl: "/platform" }),
    };

    render(await UserRegistrationPage(props));

    expect(screen.getByTestId("registration-form")).toHaveTextContent("/platform");
  });

  it("passes termsData to RegistrationForm", async () => {
    render(await UserRegistrationPage(defaultProps));

    expect(screen.getByTestId("registration-form")).toHaveTextContent("with terms");
  });

  it("redirects to signin if no user session", async () => {
    mockAuth.mockResolvedValue(null);

    try {
      await UserRegistrationPage(defaultProps);
    } catch {
      // Expected to throw NEXT_REDIRECT
    }

    expect(mockRedirect).toHaveBeenCalledWith("/api/auth/signin");
  });

  it("redirects to platform if user already registered", async () => {
    mockAuth.mockResolvedValue({ user: { id: "123", registered: true } });

    try {
      await UserRegistrationPage(defaultProps);
    } catch {
      // Expected to throw NEXT_REDIRECT
    }

    expect(mockRedirect).toHaveBeenCalledWith(`/${locale}/platform`);
  });

  it("renders with session for unregistered user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "123", registered: false } });

    render(await UserRegistrationPage(defaultProps));

    expect(screen.getByTestId("unified-navbar")).toHaveTextContent("with session");
  });

  it("renders background image using Next.js Image component", async () => {
    const mockMathRandom = vi.spyOn(Math, "random").mockReturnValue(0.5);

    render(await UserRegistrationPage(defaultProps));

    const container = document.querySelector(".relative.min-h-svh");
    expect(container).toBeInTheDocument();
    expect(container).toHaveClass("overflow-hidden");

    const image = document.querySelector('img[alt="Registration background"]');
    expect(image).toBeInTheDocument();

    const gradient = document.querySelector(".bg-gradient-to-l");
    expect(gradient).toBeInTheDocument();
    expect(gradient).toHaveClass("from-black", "via-black/80", "to-black/40");

    mockMathRandom.mockRestore();
  });

  it("renders with proper grid layout", async () => {
    render(await UserRegistrationPage(defaultProps));

    const gridContainer = document.querySelector(".grid");
    expect(gridContainer).toBeInTheDocument();
    expect(gridContainer).toHaveClass("grid-cols-1", "md:grid-cols-2");
  });
});
