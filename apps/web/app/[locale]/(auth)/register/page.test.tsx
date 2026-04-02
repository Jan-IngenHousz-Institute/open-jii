import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import UserRegistrationPage from "./page";

globalThis.React = React;

// --- Mocks ---
const mockAuth = vi.fn();
vi.mock("~/app/actions/auth", () => ({
  auth: (): unknown => mockAuth(),
}));

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string): void => {
    mockRedirect(url);
    throw new Error("NEXT_REDIRECT");
  },
}));

vi.mock("@/components/navigation/unified-navbar/unified-navbar", () => ({
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
  RegistrationForm: () => <form aria-label="registration" />,
}));

vi.mock("~/components/auth/terms-and-conditions-dialog", () => ({
  TermsAndConditionsDialog: ({ locale }: { locale: string }) =>
    Promise.resolve({ locale, content: "Terms content" }),
}));

// --- Tests ---
describe("UserRegistrationPage", () => {
  const locale = "en-US";
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

    expect(mockRedirect).toHaveBeenCalledWith("/en-US/login?callbackUrl=/en-US/register");
  });

  it("redirects to platform when already registered", async () => {
    vi.mocked(auth).mockResolvedValue(createSession());
    await RegisterPage(props);
    expect(redirect).toHaveBeenCalledWith("/en-US/platform");
  });

  it("renders registration form for unregistered authenticated user", async () => {
    const ui = await RegisterPage(props);
    render(ui);
    expect(screen.getByRole("navigation", { name: /main/i })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: /registration/i })).toBeInTheDocument();
    expect(screen.getByAltText(/registration background/i)).toBeInTheDocument();
  });
});
