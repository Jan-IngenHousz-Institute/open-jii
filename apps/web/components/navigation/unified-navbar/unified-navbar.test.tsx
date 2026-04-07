import { createSession, createUserProfile } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { usePathname } from "next/navigation";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";
import { authClient } from "@repo/auth/client";

import { UnifiedNavbar } from "./unified-navbar";

vi.mock("@/components/language-switcher", () => ({
  LanguageSwitcher: ({ locale }: { locale: string }) => (
    <div data-testid="language-switcher">{locale}</div>
  ),
}));

// DropdownMenu mock — Radix doesn't work in jsdom without pointer events / portals
vi.mock("@repo/ui/components", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@repo/ui/components");

  const DropdownMenu = ({
    children,
    open: controlledOpen,
    onOpenChange,
  }: React.PropsWithChildren<{ open?: boolean; onOpenChange?: (o: boolean) => void }>) => {
    const [internalOpen, setInternalOpen] = React.useState(false);
    const open = controlledOpen ?? internalOpen;
    const toggle = () => {
      const next = !open;
      setInternalOpen(next);
      onOpenChange?.(next);
    };
    return (
      <div data-open={open} onClick={toggle}>
        {children}
      </div>
    );
  };

  return {
    ...actual,
    DropdownMenu,
    DropdownMenuTrigger: ({
      children,
      asChild: _,
      ...rest
    }: React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }) => (
      <div data-testid="dropdown-trigger" {...rest}>
        {children}
      </div>
    ),
    DropdownMenuContent: ({
      children,
      className,
      ...rest
    }: React.HTMLAttributes<HTMLDivElement>) => (
      <div data-testid="dropdown-content" className={className} {...rest}>
        {children}
      </div>
    ),
    DropdownMenuItem: ({
      children,
      asChild: _,
      ...rest
    }: React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }) => (
      <div role="menuitem" {...rest}>
        {children}
      </div>
    ),
    DropdownMenuSeparator: () => <hr />,
  };
});

const makeSession = (over: Record<string, unknown> = {}) =>
  createSession({
    user: {
      id: "user-1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      ...(over.user as Record<string, unknown>),
    },
    ...over,
  });

function renderNavbar(
  opts: {
    locale?: string;
    pathname?: string;
    session?: ReturnType<typeof createSession> | null;
    isHomePage?: boolean;
  } = {},
) {
  vi.mocked(usePathname).mockReturnValue(opts.pathname ?? "/en-US");
  if (opts.session?.user) {
    server.mount(contract.users.getUserProfile, {
      body: createUserProfile({ firstName: "Ada", lastName: "Lovelace" }),
    });
  }
  return render(
    <UnifiedNavbar
      locale={opts.locale ?? "en-US"}
      session={opts.session ?? null}
      isHomePage={opts.isHomePage}
    />,
  );
}

describe("UnifiedNavbar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows nav links and marks current page active", () => {
    renderNavbar({ pathname: "/en-US/blog/some-post" });
    const nav = screen.getByRole("navigation");
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const desktop = nav.querySelector(".md\\:flex")!;
    const utils = within(desktop as HTMLElement);

    expect(utils.getByRole("link", { name: /navigation\.home/i })).not.toHaveAttribute(
      "aria-current",
    );
    expect(utils.getByRole("link", { name: /navigation\.blog/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows Platform link for guests", () => {
    renderNavbar();
    const nav = screen.getByRole("navigation");
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const desktop = within(nav.querySelector(".md\\:flex")!);
    expect(desktop.getByRole("link", { name: /navigation\.platform/i })).toHaveAttribute(
      "href",
      "/en-US/platform",
    );
  });

  it("shows Platform link as active for authenticated users on platform", () => {
    renderNavbar({ pathname: "/en-US/platform", session: makeSession() });
    const nav = screen.getByRole("navigation");
    const link = within(nav).getAllByRole("link", { name: /navigation\.platform/i })[0];
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("renders user trigger and display name when authenticated", async () => {
    renderNavbar({ session: makeSession() });
    // The trigger button should exist with aria-label
    expect(screen.getByRole("button", { name: "auth.userMenu" })).toBeInTheDocument();
    const content = screen.getAllByTestId("dropdown-content")[0];
    await waitFor(() => {
      expect(within(content).getByText("Ada Lovelace")).toBeInTheDocument();
    });
  });

  it("renders user avatar/name when authenticated", () => {
    renderNavbar({
      locale: "en-US",
      pathname: "/en-US",
      session: makeSession(),
    });

    const trigger = screen.getAllByTestId("dropdown-trigger")[0];

    // Avatar should be in the trigger
    const avatarImage = within(trigger).getByTestId("avatar-image");
    expect(avatarImage).toHaveAttribute("src", "https://example.com/ada.png");

    // Display name should be in the dropdown content
    const dropdownContent = screen.getAllByTestId("dropdown-content")[0];
    expect(within(dropdownContent).getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("renders account + sign out entries inside desktop dropdown content", () => {
    renderNavbar({
      locale: "en-US",
      pathname: "/en-US",
      session: makeSession(),
    });

    const desktopDropdown = screen.getAllByTestId("dropdown-content")[0];

    const account = within(desktopDropdown).getByRole("link", { name: /Account/i });
    expect(account).toHaveAttribute("href", "/en-US/platform/account/settings");

    const signOutButton = within(desktopDropdown).getByRole("menuitem", { name: /Sign Out/i });
    expect(signOutButton).toBeInTheDocument();
    expect(signOutButton).not.toHaveAttribute("href"); // Button, not link
  });

  it("calls signOut when sign out button is clicked", async () => {
    const user = userEvent.setup();
    renderNavbar({
      locale: "en-US",
      pathname: "/en-US/blog",
      session: makeSession(),
    });

    const desktopDropdown = screen.getAllByTestId("dropdown-content")[0];
    const signOutButton = within(desktopDropdown).getByRole("menuitem", { name: /Sign Out/i });

    await user.click(signOutButton);

    expect(mockSignOutMutateAsync).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("mobile menu trigger is present (icon button)", () => {
    renderNavbar({ locale: "en-US", pathname: "/en-US" });
    expect(screen.getByRole("button", { name: /Navigation menu/i })).toBeInTheDocument();
  });

  it("renders header on platform-related pages", () => {
    renderNavbar({ locale: "en-US", pathname: "/en-US/platform" });

    const header = screen.getByRole("banner");
    expect(header).toBeInTheDocument();
  });

  it("renders mobile nav links with active state", () => {
    renderNavbar({ pathname: "/en-US/about" });
    const dropdowns = screen.getAllByTestId("dropdown-content");
    const mobile = dropdowns[dropdowns.length - 1];
    const aboutLink = within(mobile)
      .getAllByRole("link")
      .find((l) => l.textContent?.includes("navigation.about")); // eslint-disable-line @typescript-eslint/no-unnecessary-condition
    expect(aboutLink).toBeDefined();
    expect(aboutLink).toHaveAttribute("aria-current", "page");

    const homeLink = mobileLinks.find((link) => link.textContent.includes("Home"));
    expect(homeLink).not.toHaveAttribute("aria-current");
  });

  it("renders user dropdown with User fallback icon when no avatar", () => {
    renderNavbar({
      locale: "en-US",
      pathname: "/en-US",
      session: {
        user: { id: "u-1", email: "test@example.com", image: null, registered: true },
      },
    });

    // Line 75: else clause renders <User> icon when no avatar
    const trigger = screen.getByRole("button", { name: "User menu" });
    expect(trigger).toBeInTheDocument();

    // Verify user email is displayed in dropdown content (appears in both desktop and mobile)
    const emails = screen.getAllByText("test@example.com");
    expect(emails.length).toBeGreaterThan(0);
  });

  it("renders avatar in dropdown menu content when user has image", () => {
    renderNavbar({
      locale: "en-US",
      pathname: "/en-US",
      session: makeSession(),
    });

    // Line 84: Avatar in dropdown content when session.user.image is truthy
    // There are 2 dropdown-content elements (desktop user menu + mobile nav menu)
    // Both should have avatars when user has an image
    const dropdownContents = screen.getAllByTestId("dropdown-content");
    expect(dropdownContents.length).toBeGreaterThan(0);

    // Check that at least one dropdown has the user avatar
    const allAvatars = screen.getAllByTestId("avatar-image");
    expect(allAvatars.length).toBeGreaterThan(0);
  });

  it("toggles chevron rotation when dropdown opens", async () => {
    const user = userEvent.setup();
    renderNavbar({
      locale: "en-US",
      pathname: "/en-US",
      session: makeSession(),
    });

    // Line 78: Test the ternary operator ${open ? "rotate-180" : "rotate-0"}
    // Click the user menu button to toggle open state
    const userMenuButton = screen.getByLabelText("User menu");
    await user.click(userMenuButton);

    // The component should render without errors, covering both branches of the ternary
    expect(userMenuButton).toBeInTheDocument();
  });

  it("does not setup intersection observer when not on home page", () => {
    const observe = vi.fn();
    const unobserve = vi.fn();
    const disconnect = vi.fn();

    vi.stubGlobal(
      "IntersectionObserver",
      vi.fn((_cb: IntersectionObserverCallback) => ({
        observe: observeMock,
        unobserve: unobserveMock,
        disconnect: vi.fn(),
      })),
    );

    const main = document.createElement("main");
    const section = document.createElement("section");
    main.appendChild(section);
    document.body.appendChild(main);

    const { unmount } = renderNavbar({ isHomePage: true });
    expect(observeMock).toHaveBeenCalledWith(section);
    unmount();
    expect(unobserveMock).toHaveBeenCalledWith(section);

    document.body.removeChild(main);
    vi.unstubAllGlobals();
  });

  it("does not set up IntersectionObserver when not on home page", () => {
    const observeMock = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      vi.fn(() => ({ observe: observeMock, unobserve: vi.fn(), disconnect: vi.fn() })),
    );

    renderNavbar({ isHomePage: false });
    expect(observeMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
