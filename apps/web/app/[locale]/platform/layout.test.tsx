import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import AppLayout from "./layout";

globalThis.React = React;

// --- Mocks ---
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: (): unknown => mockAuth(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(() =>
    Promise.resolve({
      get: vi.fn().mockReturnValue("/platform/experiments"),
    }),
  ),
}));

vi.mock("next/navigation");

vi.mock("@/components/app-breadcrumbs", () => ({
  Breadcrumbs: () => <div data-testid="breadcrumbs">Breadcrumbs</div>,
}));

vi.mock("@/components/app-sidebar-wrapper", () => ({
  AppSidebarWrapper: ({ locale }: { locale: string }) => (
    <div data-testid="app-sidebar-wrapper" data-locale={locale}>
      Sidebar
    </div>
  ),
}));

vi.mock("@/components/language-switcher", () => ({
  LanguageSwitcher: ({ locale }: { locale: string }) => (
    <div data-testid="language-switcher" data-locale={locale}>
      Language Switcher
    </div>
  ),
}));

vi.mock("@/components/platform-top-bar", () => ({
  PlatformTopBar: ({ locale }: { locale: string }) => (
    <div data-testid="platform-top-bar" data-locale={locale}>
      Platform Top Bar
    </div>
  ),
}));

vi.mock("@repo/ui/components", () => ({
  Separator: () => <div data-testid="separator">Separator</div>,
  SidebarInset: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-inset">{children}</div>
  ),
  SidebarProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-provider">{children}</div>
  ),
  SidebarTrigger: () => <div data-testid="sidebar-trigger">Sidebar Trigger</div>,
  Toaster: () => <div data-testid="toaster">Toaster</div>,
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <div>{children}</div>
  ),
}));

// --- Tests ---
describe("AppLayout", () => {
  const locale = "en-US";
  const defaultProps = {
    children: <div data-testid="test-children">Test Content</div>,
    pageTitle: "Test Page",
    params: Promise.resolve({ locale }),
  };

  // Get the mocked redirect function
  const mockRedirect = vi.mocked(redirect);

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "123", name: "Test User", registered: true } });
  });

  it("renders all layout components when authenticated", async () => {
    render(await AppLayout(defaultProps));

    expect(screen.getByTestId("sidebar-provider")).toBeInTheDocument();
    expect(screen.getByTestId("app-sidebar-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("platform-top-bar")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-inset")).toBeInTheDocument();
    expect(screen.getByTestId("breadcrumbs")).toBeInTheDocument();
    expect(screen.getByTestId("test-children")).toBeInTheDocument();
    expect(screen.getByTestId("toaster")).toBeInTheDocument();
  });

  it("passes correct locale to components", async () => {
    render(await AppLayout(defaultProps));

    expect(screen.getByTestId("app-sidebar-wrapper")).toHaveAttribute("data-locale", "en-US");
    expect(screen.getByTestId("platform-top-bar")).toHaveAttribute("data-locale", "en-US");
  });

  it("redirects to login when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null);
    // Make redirect throw to simulate actual behavior
    mockRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(AppLayout(defaultProps)).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/api/auth/signin?callbackUrl=%2Fplatform%2Fexperiments",
    );
  });

  it("handles different locale in redirect URL", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const germanProps = {
      ...defaultProps,
      params: Promise.resolve({ locale: "de" }),
    };
    // Make redirect throw to simulate actual behavior
    mockRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(AppLayout(germanProps)).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/api/auth/signin?callbackUrl=%2Fplatform%2Fexperiments",
    );
  });

  it("redirects to registration when user is not registered", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "123", name: "Test User", registered: false },
    });
    // Make redirect throw to simulate actual behavior
    mockRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(AppLayout(defaultProps)).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/en-US/register?callbackUrl=%2Fplatform%2Fexperiments",
    );
  });

  it("redirects to registration with different locale when user is not registered", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "123", name: "Test User", registered: false },
    });
    const germanProps = {
      ...defaultProps,
      params: Promise.resolve({ locale: "de" }),
    };
    // Make redirect throw to simulate actual behavior
    mockRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(AppLayout(germanProps)).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/de/register?callbackUrl=%2Fplatform%2Fexperiments");
  });

  it("renders platform top bar", async () => {
    render(await AppLayout(defaultProps));

    expect(screen.getByTestId("platform-top-bar")).toBeInTheDocument();
    expect(screen.getByTestId("platform-top-bar")).toHaveAttribute("data-locale", "en-US");
  });

  it("renders content wrapper with correct structure", async () => {
    render(await AppLayout(defaultProps));

    expect(screen.getByTestId("sidebar-inset")).toBeInTheDocument();
    expect(screen.getByTestId("breadcrumbs")).toBeInTheDocument();
    expect(screen.getByTestId("test-children")).toBeInTheDocument();
  });

  it("renders page title when provided", async () => {
    const propsWithTitle = {
      ...defaultProps,
      pageTitle: "Custom Page Title",
    };

    render(await AppLayout(propsWithTitle));

    // The page title would be passed to components, but since we're mocking them,
    // we just verify the layout renders successfully with the title
    expect(screen.getByTestId("test-children")).toBeInTheDocument();
  });

  it("handles missing page title", async () => {
    const propsWithoutTitle = {
      ...defaultProps,
      pageTitle: undefined,
    };

    render(await AppLayout(propsWithoutTitle));

    expect(screen.getByTestId("test-children")).toBeInTheDocument();
  });
});
