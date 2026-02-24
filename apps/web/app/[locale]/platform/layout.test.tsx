/**
 * AppLayout test — focuses on the layout's core responsibilities:
 *
 * 1. Auth gating: redirects unauthenticated / unregistered users
 * 2. Renders children inside the application chrome
 *
 * Navigation sub-components (sidebar, topbar, breadcrumbs) are mocked
 * since they have their own tests and complex internal state/data deps.
 * UI primitives (SidebarProvider, etc.) render as real components.
 *
 * Global mocks (next/navigation, next/headers, i18n) from test/setup.ts.
 */
import { createSession } from "@/test/factories";
import { render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import AppLayout from "./layout";

// ── Feature component mocks (tested separately) ────────────────

const mockAuth = vi.fn();
vi.mock("~/app/actions/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/components/navigation/navigation-breadcrumbs/navigation-breadcrumbs", () => ({
  Breadcrumbs: () => <nav aria-label="breadcrumbs">Breadcrumbs</nav>,
}));

vi.mock("@/components/navigation/navigation-sidebar-wrapper/navigation-sidebar-wrapper", () => ({
  NavigationSidebarWrapper: () => <aside aria-label="sidebar">Sidebar</aside>,
}));

vi.mock("@/components/navigation/navigation-topbar/navigation-topbar", () => ({
  NavigationTopbar: () => <header aria-label="topbar">Topbar</header>,
}));

// ── Tests ───────────────────────────────────────────────────────

describe("AppLayout", () => {
  const defaultProps = {
    children: <div>Page content</div>,
    params: Promise.resolve({ locale: "en-US" }),
  };

  const mockRedirect = vi.mocked(redirect);

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(createSession());
  });

  // ── Happy path ──────────────────────────────────────────────

  it("renders children inside the layout when authenticated", async () => {
    render(await AppLayout(defaultProps));

    expect(screen.getByText("Page content")).toBeInTheDocument();
    expect(screen.getByText("Sidebar")).toBeInTheDocument();
    expect(screen.getByText("Topbar")).toBeInTheDocument();
    expect(screen.getByText("Breadcrumbs")).toBeInTheDocument();
  });

  // ── Auth gating ─────────────────────────────────────────────

  it("redirects to login when there is no session", async () => {
    mockAuth.mockResolvedValue(null);
    mockRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(AppLayout(defaultProps)).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/en-US/login?callbackUrl=%2Fplatform%2Fexperiments");
  });

  it("redirects to registration when user exists but is not registered", async () => {
    mockAuth.mockResolvedValue(
      createSession({
        user: {
          id: "1",
          name: "New",
          email: "a@b.com",
          registered: false,
          firstName: "New",
          lastName: "User",
        },
      }),
    );
    mockRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(AppLayout(defaultProps)).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/en-US/register?callbackUrl=%2Fplatform%2Fexperiments",
    );
  });

  it("uses the correct locale in redirect URLs", async () => {
    mockAuth.mockResolvedValue(null);
    mockRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    const deProps = { ...defaultProps, params: Promise.resolve({ locale: "de" }) };

    await expect(AppLayout(deProps)).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/de/login?callbackUrl=%2Fplatform%2Fexperiments");
  });
});
