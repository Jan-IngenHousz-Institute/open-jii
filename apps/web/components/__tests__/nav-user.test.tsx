import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import Image from "next/image";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Locale } from "@repo/i18n";

import { NavUser } from "../nav-user";

globalThis.React = React;

/* -------------------- Mocks -------------------- */

vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) =>
      ({
        "auth.account": "Account",
        "navigation.logout": "Sign out",
      })[k] ?? k,
  }),
}));

const useSidebarMock = vi.fn();

vi.mock("@repo/ui/components", () => {
  // Sidebar primitives
  const SidebarMenu = ({ children }: React.PropsWithChildren) => (
    <nav aria-label="user menu">{children}</nav>
  );
  const SidebarMenuItem = ({ children }: React.PropsWithChildren) => <div>{children}</div>;
  const SidebarMenuButton = ({
    children,
    className,
    size,
  }: React.PropsWithChildren<{ className?: string; size?: "lg" | "sm" }>) => (
    <button data-testid="sidebar-button" data-size={size} className={className}>
      {children}
    </button>
  );

  // Avatar primitives
  const Avatar = ({ children, className }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="avatar" className={className}>
      {children}
    </div>
  );
  const AvatarImage = (
    props: React.ImgHTMLAttributes<HTMLImageElement> & { src: string; alt: string },
  ) => {
    const { width: w, height: h, ...rest } = props;
    const width = typeof w === "string" ? parseInt(w, 10) : (w ?? 32);
    const height = typeof h === "string" ? parseInt(h, 10) : (h ?? 32);
    return <Image data-testid="avatar-image" width={width} height={height} {...rest} />;
  };
  const AvatarFallback = ({ children, className }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="avatar-fallback" className={className}>
      {children}
    </div>
  );

  // Dropdown primitives
  const DropdownMenu = ({ children }: React.PropsWithChildren) => <div>{children}</div>;
  const DropdownMenuTrigger = ({ children }: React.PropsWithChildren) => (
    <div data-testid="dropdown-trigger">{children}</div>
  );
  const DropdownMenuContent = ({
    children,
    side,
    align,
    sideOffset,
    className,
  }: React.PropsWithChildren<{
    side?: "bottom" | "right" | "left" | "top";
    align?: "start" | "end" | "center";
    sideOffset?: number;
    className?: string;
  }>) => (
    <div
      data-testid="dropdown-content"
      data-side={side}
      data-align={align}
      data-offset={String(sideOffset ?? "")}
      className={className}
    >
      <span data-testid="dropdown-props" />
      {children}
    </div>
  );

  const DropdownMenuItem = ({ children }: React.HTMLAttributes<HTMLDivElement>) => (
    <div role="menuitem">{children}</div>
  );
  const DropdownMenuSeparator = () => <hr />;
  const DropdownMenuLabel = ({ children }: React.PropsWithChildren) => (
    <div data-testid="dropdown-label">{children}</div>
  );

  return {
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    Avatar,
    AvatarImage,
    AvatarFallback,
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuLabel,
    useSidebar: (): { isMobile: boolean } => useSidebarMock() as { isMobile: boolean },
  };
});

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

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    className,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : String(href)} className={className} {...rest}>
      {children}
    </a>
  ),
}));

// lucide-react icons
vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  );
  return {
    ChevronsUpDown: Icon,
    LogOut: Icon,
    User: Icon,
    UserIcon: Icon,
  };
});

/* -------------------- Helpers -------------------- */

const baseUser = {
  id: "u-1",
  email: "ada@example.com",
  avatar: "https://example.com/a.png",
};

function renderNav(
  over: {
    profile?: ProfileBody;
    isMobile?: boolean;
    locale?: Locale;
  } = {},
) {
  useSidebarMock.mockReturnValue({ isMobile: over.isMobile ?? false });
  useGetUserProfileMock.mockReturnValue({
    data: {
      body: over.profile ?? undefined,
    },
  });

  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <NavUser user={baseUser} locale={over.locale ?? ("en-US" as Locale)} />
    </QueryClientProvider>,
  );
}

/* -------------------- Tests -------------------- */

describe("<NavUser />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders display name (from profile), email, avatar (src+alt) and links", () => {
    renderNav({
      profile: { firstName: "Ada", lastName: "Lovelace" },
      isMobile: false,
      locale: "en-US" as Locale,
    });

    const triggerBtn = screen.getByTestId("sidebar-button");

    // The name lives in a span.font-medium inside the button
    expect(within(triggerBtn).getByText("Ada Lovelace")).toBeInTheDocument();

    // Email is shown
    expect(within(triggerBtn).getByText("ada@example.com")).toBeInTheDocument();

    // Avatar image src and alt reflect displayName
    const img = screen.getAllByTestId("avatar-image")[0];
    expect(img.getAttribute("src")).toContain(encodeURIComponent("https://example.com/a.png"));
    expect(img).toHaveAttribute("alt", "Ada Lovelace");

    // Initials in the *first* fallback (button avatar)
    const firstFallback = screen.getAllByTestId("avatar-fallback")[0];
    expect(firstFallback).toHaveTextContent("AD");

    // Dropdown contains Account + Sign out entries with expected hrefs
    const accountItem = screen.getByRole("menuitem", { name: /Account/i }).querySelector("a");
    expect(accountItem).toHaveAttribute("href", "/en-US/platform/account/settings");

    const signoutItem = screen.getByRole("menuitem", { name: /Sign out/i }).querySelector("a");
    expect(signoutItem).toHaveAttribute("href", "/en-US/platform/signout");

    // Chevron icon present
    expect(screen.getAllByTestId("icon")[0]).toBeInTheDocument();
  });

  it("falls back to 'JII' initials and empty name when profile name is missing", () => {
    renderNav({ profile: undefined, isMobile: false });

    const triggerBtn = screen.getByTestId("sidebar-button");

    // First avatar fallback (button avatar) shows JII
    const firstFallback = screen.getAllByTestId("avatar-fallback")[0];
    expect(firstFallback).toHaveTextContent("JII");

    // Name span in the trigger should be empty (no displayName)
    const nameSpan = triggerBtn.querySelector("span.font-medium");
    expect(nameSpan).toHaveTextContent("");

    // Email present
    expect(within(triggerBtn).getByText("ada@example.com")).toBeInTheDocument();

    // Image alt falls back to empty string
    expect(screen.getAllByTestId("avatar-image")[0]).toHaveAttribute("alt", "");
  });

  it("positions dropdown content to the right on desktop and bottom on mobile", () => {
    // Desktop (isMobile=false) -> side="right"
    renderNav({ profile: { firstName: "Ada", lastName: "Lovelace" }, isMobile: false });
    const desktopContent = screen.getByTestId("dropdown-content");
    expect(desktopContent).toHaveAttribute("data-side", "right");
    expect(desktopContent).toHaveAttribute("data-align", "end");
    expect(desktopContent).toHaveAttribute("data-offset", "4");

    // Mobile (isMobile=true) -> side="bottom"
    renderNav({ profile: { firstName: "Ada", lastName: "Lovelace" }, isMobile: true });
    const mobileContents = screen.getAllByTestId("dropdown-content");
    const last = mobileContents[mobileContents.length - 1];
    expect(last).toHaveAttribute("data-side", "bottom");
    expect(last).toHaveAttribute("data-align", "end");
    expect(last).toHaveAttribute("data-offset", "4");
  });
});
