import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { useFeatureFlagEnabled } from "posthog-js/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import type { User } from "@repo/auth/types";
import { useSidebar } from "@repo/ui/components";

import { NavigationTopbar } from "./navigation-topbar";

// Requires SidebarProvider context for SidebarMenu* components
vi.mock("../nav-user/nav-user", () => ({
  NavUser: () => <span>nav-user</span>,
}));

// useSidebar — pragmatic mock (requires SidebarProvider context not in test wrapper)
vi.mock("@repo/ui/components", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useSidebar: vi.fn(() => ({
      state: "expanded" as const,
      open: false,
      setOpen: vi.fn(),
      openMobile: false,
      setOpenMobile: vi.fn(),
      isMobile: false,
      toggleSidebar: vi.fn(),
    })),
    // SidebarTrigger calls useSidebar internally via closured reference,
    // so the mock above doesn't intercept it. Mock the component directly.
    SidebarTrigger: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button aria-label="Toggle Sidebar" {...props} />
    ),
  };
});

const testUser: User = {
  id: "user-123",
  name: "Test User",
  email: "test@example.com",
  emailVerified: true,
  image: "/avatar.jpg",
  registered: true,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

describe("NavigationTopbar", () => {
  it("renders logo linked to platform root with locale", () => {
    render(<NavigationTopbar locale="en" user={testUser} />);
    const logo = screen.getAllByAltText("JII Logo")[0];
    expect(logo.closest("a")).toHaveAttribute("href", "/en/platform");
  });

  it("renders disabled notification button", () => {
    render(<NavigationTopbar locale="en" user={testUser} />);
    expect(screen.getByLabelText("common.notifications")).toBeDisabled();
  });

  it("opens mobile menu and shows navigation items", async () => {
    const user = userEvent.setup();
    render(<NavigationTopbar locale="en" user={testUser} />);
    expect(screen.queryByText("navigation.logout")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Open menu"));

    await waitFor(() => {
      expect(screen.getByText("navigation.logout")).toBeInTheDocument();
    });
  });

  it("signs out and navigates home via mobile menu", async () => {
    const user = userEvent.setup();
    const { router } = render(<NavigationTopbar locale="en" user={testUser} />);
    await user.click(screen.getByLabelText("Open menu"));

    await waitFor(() => {
      expect(screen.getByText("navigation.logout")).toBeInTheDocument();
    });

    await user.click(screen.getByText("navigation.logout"));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/");
    });
  });

  it("shows sidebar trigger when sidebar is collapsed", () => {
    vi.mocked(useSidebar).mockReturnValueOnce({
      state: "collapsed",
      open: false,
      setOpen: vi.fn(),
      openMobile: false,
      setOpenMobile: vi.fn(),
      isMobile: false,
      toggleSidebar: vi.fn(),
    });

    render(<NavigationTopbar locale="en" user={testUser} />);
    expect(screen.getByRole("button", { name: /toggle sidebar/i })).toBeInTheDocument();
  });

  it("shows language options when multi-language flag is enabled", async () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);

    const user = userEvent.setup();
    render(<NavigationTopbar locale="en" user={testUser} />);
    await user.click(screen.getByLabelText("Open menu"));

    await waitFor(() => {
      expect(screen.getByText("common.language")).toBeInTheDocument();
      expect(screen.getByText("English")).toBeInTheDocument();
      expect(screen.getByText("Deutsch")).toBeInTheDocument();
    });
  });
});
