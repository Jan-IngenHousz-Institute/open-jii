import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import LoginPage from "./page";

globalThis.React = React;

// --- Mocks ---
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: (): unknown => mockAuth(),
  providerMap: [],
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

vi.mock("~/components/auth/login-form", () => ({
  LoginForm: ({ callbackUrl, locale }: { callbackUrl?: string; locale: string }) => (
    <div data-testid="login-form">
      Login form - {locale} - {callbackUrl ?? "no callback"}
    </div>
  ),
}));

// --- Tests ---
describe("LoginPage", () => {
  const locale = "en-US";
  const defaultProps = {
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve({}),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(null);
  });

  it("renders the page with all components", async () => {
    render(await LoginPage(defaultProps));

    expect(screen.getByTestId("unified-navbar")).toBeInTheDocument();
    expect(screen.getByTestId("auth-hero-section")).toBeInTheDocument();
    expect(screen.getByTestId("login-form")).toBeInTheDocument();
  });

  it("passes the correct locale to components", async () => {
    render(await LoginPage(defaultProps));

    expect(screen.getByTestId("unified-navbar")).toHaveTextContent("en-US");
    expect(screen.getByTestId("auth-hero-section")).toHaveTextContent("en-US");
    expect(screen.getByTestId("login-form")).toHaveTextContent("en-US");
  });

  it("passes callbackUrl to LoginForm when provided", async () => {
    const props = {
      ...defaultProps,
      searchParams: Promise.resolve({ callbackUrl: "/platform" }),
    };

    render(await LoginPage(props));

    expect(screen.getByTestId("login-form")).toHaveTextContent("/platform");
  });

  it("renders without session", async () => {
    mockAuth.mockResolvedValue(null);

    render(await LoginPage(defaultProps));

    expect(screen.getByTestId("unified-navbar")).toHaveTextContent("no session");
  });

  it("renders with session", async () => {
    mockAuth.mockResolvedValue({ user: { id: "123", name: "Test User" } });

    render(await LoginPage(defaultProps));

    expect(screen.getByTestId("unified-navbar")).toHaveTextContent("with session");
  });

  it("renders background image using Next.js Image component", async () => {
    const mockMathRandom = vi.spyOn(Math, "random").mockReturnValue(0.5);

    render(await LoginPage(defaultProps));

    // Check for fixed background container
    const backgroundContainer = document.querySelector(".fixed.inset-0.z-0");
    expect(backgroundContainer).toBeInTheDocument();

    const image = document.querySelector('img[alt="Login background"]');
    expect(image).toBeInTheDocument();

    const gradient = document.querySelector(".bg-gradient-to-l");
    expect(gradient).toBeInTheDocument();
    expect(gradient).toHaveClass("from-black", "via-black/80", "to-black/40");

    // Check for foreground content container
    const foregroundContainer = document.querySelector(".relative.z-10");
    expect(foregroundContainer).toBeInTheDocument();
    expect(foregroundContainer).toHaveClass("flex", "h-[calc(100vh-4rem)]");

    mockMathRandom.mockRestore();
  });

  it("renders with proper grid layout", async () => {
    render(await LoginPage(defaultProps));

    const gridContainer = document.querySelector(".grid.h-full");
    expect(gridContainer).toBeInTheDocument();
    expect(gridContainer).toHaveClass("grid-cols-1", "md:grid-cols-2");
  });
});
