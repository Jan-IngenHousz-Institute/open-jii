import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import AuthErrorPage from "./page";

globalThis.React = React;

// --- Mocks ---
const mockAuth = vi.fn();
vi.mock("~/app/actions/auth", () => ({
  auth: (): unknown => mockAuth(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
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

vi.mock("~/components/auth/error-content", () => ({
  ErrorContent: ({ locale }: { locale: string; error?: string; errorDescription?: string }) => (
    <div data-testid="error-content">Error content - {locale}</div>
  ),
}));

// --- Tests ---
describe("AuthErrorPage", () => {
  const locale = "en-US";
  const defaultProps = {
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve({ error: "test_error" }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(null);
  });

  it("renders the page with all components", async () => {
    render(await AuthErrorPage(defaultProps));

    expect(screen.getByTestId("unified-navbar")).toBeInTheDocument();
    expect(screen.getByTestId("auth-hero-section")).toBeInTheDocument();
    expect(screen.getByTestId("error-content")).toBeInTheDocument();
  });

  it("passes the correct locale to components", async () => {
    render(await AuthErrorPage(defaultProps));

    expect(screen.getByTestId("unified-navbar")).toHaveTextContent("en-US");
    expect(screen.getByTestId("auth-hero-section")).toHaveTextContent("en-US");
    expect(screen.getByTestId("error-content")).toHaveTextContent("en-US");
  });

  it("renders without session", async () => {
    mockAuth.mockResolvedValue(null);

    render(await AuthErrorPage(defaultProps));

    expect(screen.getByTestId("unified-navbar")).toHaveTextContent("no session");
  });

  it("renders with session", async () => {
    mockAuth.mockResolvedValue({ user: { id: "123", name: "Test User" } });

    render(await AuthErrorPage(defaultProps));

    expect(screen.getByTestId("unified-navbar")).toHaveTextContent("with session");
  });

  it("renders background image using Next.js Image component", async () => {
    const mockMathRandom = vi.spyOn(Math, "random").mockReturnValue(0.5);

    render(await AuthErrorPage(defaultProps));

    const image = screen.getByAltText("Error background");
    expect(image).toBeInTheDocument();

    mockMathRandom.mockRestore();
  });

  it("calls notFound when no error query parameter is provided", async () => {
    const propsWithoutError = {
      params: Promise.resolve({ locale }),
      searchParams: Promise.resolve({}),
    };

    await AuthErrorPage(propsWithoutError);

    expect(notFound).toHaveBeenCalled();
  });

  it("renders when error parameter is empty string", async () => {
    const propsWithEmptyError = {
      params: Promise.resolve({ locale }),
      searchParams: Promise.resolve({ error: "" }),
    };

    render(await AuthErrorPage(propsWithEmptyError));

    expect(screen.getByTestId("error-content")).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });
});
