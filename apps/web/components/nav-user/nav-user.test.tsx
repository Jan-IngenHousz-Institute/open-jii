import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Locale } from "@repo/i18n";
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
    locale?: Locale;
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
        <NavUser user={baseUser} locale={over.locale ?? ("en-US" as Locale)} />
      </SidebarProvider>
    </QueryClientProvider>,
  );
}

/* -------------------- Tests -------------------- */

describe("<NavUser />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders display name (from profile), email, avatar and basic functionality", () => {
    renderNav({
      profile: { firstName: "Ada", lastName: "Lovelace" },
      locale: "en-US" as Locale,
    });

    // Find the trigger button
    const triggerBtn = screen.getByRole("button");

    // The name and email should be visible in the button
    expect(within(triggerBtn).getByText("Ada Lovelace")).toBeInTheDocument();
    expect(within(triggerBtn).getByText("ada@example.com")).toBeInTheDocument();

    // Initials should be in the fallback (AD for Ada Lovelace)
    expect(screen.getByText("AD")).toBeInTheDocument();

    expect(triggerBtn.querySelector("svg")).toBeInTheDocument();

    // Button should be clickable
    expect(triggerBtn).not.toBeDisabled();
  });

  it("falls back to 'JII' initials and empty name when profile name is missing", () => {
    renderNav({ profile: undefined });

    const triggerBtn = screen.getByRole("button");

    // JII fallback should be present
    expect(screen.getByText("JII")).toBeInTheDocument();

    // Email should be present in the button
    expect(within(triggerBtn).getByText("ada@example.com")).toBeInTheDocument();

    // The name span should be empty (no text content)
    const nameSpan = triggerBtn.querySelector("span.font-medium");
    expect(nameSpan).toHaveTextContent("");
  });

  it("renders dropdown menu with account and logout links", async () => {
    const user = userEvent.setup();
    renderNav({
      profile: { firstName: "Ada", lastName: "Lovelace" },
      locale: "en-US" as Locale,
    });

    // open the menu
    await user.click(screen.getByRole("button"));

    // Radix renders anchors with role="menuitem"
    const accountItem = screen.getByRole("menuitem", { name: "auth.account" });
    expect(accountItem).toHaveAttribute("href", "/en-US/platform/account/settings");

    const logoutItem = screen.getByRole("menuitem", { name: "navigation.logout" });
    expect(logoutItem).toHaveAttribute("href", "/en-US/platform/signout");
  });
});
