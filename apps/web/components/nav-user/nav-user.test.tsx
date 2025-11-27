import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { SidebarProvider } from "@repo/ui/components";

import { NavUser } from "./nav-user";

globalThis.React = React;

/* -------------------- Mocks -------------------- */

Object.defineProperty(window, "matchMedia", {
  value: vi.fn().mockImplementation(() => {
    return {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  }),
});

// i18n – returns the key (intentionally dumb)
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

// Profile hook
type ProfileBody = { firstName?: string; lastName?: string } | undefined;
const useGetUserProfileMock = vi.fn();

// Mock the TSR object that useGetUserProfile depends on
vi.mock("@/lib/tsr", () => ({
  tsr: {
    users: {
      getUserProfile: {
        useQuery: (config: { queryData: { params: { id: string } } }) =>
          useGetUserProfileMock(config.queryData.params.id) as { data: { body: ProfileBody } },
      },
    },
  },
}));

/* -------------------- Helpers -------------------- */

const baseUser = {
  id: "u-1",
  email: "ada@example.com",
  avatar: "https://example.com/a.png",
};

function renderNav(
  over: {
    profile?: ProfileBody;
    locale?: string;
  } = {},
) {
  useGetUserProfileMock.mockReturnValue({
    data: {
      body: over.profile ?? undefined,
    },
  });

  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <NavUser user={baseUser} locale={over.locale ?? "en-US"} />
      </SidebarProvider>
    </QueryClientProvider>,
  );
}

/* -------------------- Tests -------------------- */

describe("<NavUser />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders avatar and chevron icon in button", () => {
    renderNav({
      profile: { firstName: "Ada", lastName: "Lovelace" },
      locale: "en-US",
    });

    // Find the trigger button
    const triggerBtn = screen.getByRole("button");

    // Initials should be in the fallback
    expect(screen.getByText("JII")).toBeInTheDocument();

    // Should have chevron icon
    expect(triggerBtn.querySelector("svg")).toBeInTheDocument();

    // Button should be clickable
    expect(triggerBtn).not.toBeDisabled();
  });

  it("renders avatar with JII fallback", () => {
    renderNav({ profile: undefined });

    const triggerBtn = screen.getByRole("button");

    // JII fallback should be present
    expect(screen.getByText("JII")).toBeInTheDocument();
    
    // Button should exist and be clickable
    expect(triggerBtn).toBeInTheDocument();
    expect(triggerBtn).not.toBeDisabled();
  });

  it("renders dropdown menu with account and logout links", async () => {
    const user = userEvent.setup();
    renderNav({
      profile: { firstName: "Ada", lastName: "Lovelace" },
      locale: "en-US",
    });

    // open the menu
    await user.click(screen.getByRole("button"));

    // Radix renders anchors with role="menuitem"
    const accountItem = screen.getByRole("menuitem", { name: "auth.account" });
    expect(accountItem).toHaveAttribute("href", "/en-US/platform/account/settings");

    const logoutItem = screen.getByRole("menuitem", { name: "navigation.logout" });
    expect(logoutItem).toHaveAttribute("href", "/en-US/platform/signout");
  });

  it("renders with avatar and chevron icon", () => {
    renderNav({
      profile: { firstName: "Ada", lastName: "Lovelace" },
    });

    const triggerBtn = screen.getByRole("button");
    expect(triggerBtn).toBeInTheDocument();

    // Should have avatar visible
    expect(screen.getByText("JII")).toBeInTheDocument();

    // Should have chevron icon
    expect(triggerBtn.querySelector("svg")).toBeInTheDocument();
  });
});
