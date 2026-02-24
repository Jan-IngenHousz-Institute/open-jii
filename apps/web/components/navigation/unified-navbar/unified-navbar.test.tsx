import { render, screen, userEvent } from "@/test/test-utils";
import { within } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Session } from "@repo/auth/types";

import { UnifiedNavbar } from "./unified-navbar";

// Hoisted mocks
const { mockPush, usePathnameMock, mockSignOutMutateAsync, mockProfileRef } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  usePathnameMock: vi.fn(() => "/en-US"),
  mockSignOutMutateAsync: vi.fn(),
  mockProfileRef: { current: undefined as { firstName?: string; lastName?: string } | undefined },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("~/hooks/auth", () => ({
  useSignOut: () => ({ mutateAsync: mockSignOutMutateAsync, isPending: false }),
}));

vi.mock("@/hooks/profile/useGetUserProfile/useGetUserProfile", () => ({
  useGetUserProfile: () =>
    mockProfileRef.current ? { data: { body: mockProfileRef.current } } : { data: undefined },
}));

// unified-navbar uses react-i18next directly (not @repo/i18n)
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, fallback?: string) =>
      ({
        "navigation.home": "Home",
        "navigation.about": "About",
        "navigation.blog": "Blog",
        "navigation.platform": "Platform",
        "navigation.menu": "Navigation menu",
        "navigation.faq": "FAQ",
        "auth.userMenu": "User menu",
        "auth.account": "Account",
        "auth.signOut": "Sign Out",
      })[k] ??
      fallback ??
      k,
  }),
}));

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

const makeSession = (over: Partial<Session> = {}): Session =>
  ({
    user: {
      id: "user-1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      image: "https://example.com/ada.png",
      registered: true,
    },
    expires: new Date(Date.now() + 3600_000).toISOString(),
    ...over,
  }) as Session;

function renderNavbar(
  opts: { locale?: string; pathname?: string; session?: Session | null; isHomePage?: boolean } = {},
) {
  usePathnameMock.mockReturnValue(opts.pathname ?? "/en-US");
  mockProfileRef.current = opts.session?.user
    ? { firstName: "Ada", lastName: "Lovelace" }
    : undefined;
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
    const desktop = nav.querySelector(".md\\:flex")!;
    const utils = within(desktop as HTMLElement);

    expect(utils.getByRole("link", { name: /Home/i })).not.toHaveAttribute("aria-current");
    expect(utils.getByRole("link", { name: /Blog/i })).toHaveAttribute("aria-current", "page");
  });

  it("shows Platform link for guests", () => {
    renderNavbar();
    const nav = screen.getByRole("navigation");
    const desktop = within(nav.querySelector(".md\\:flex") as HTMLElement);
    expect(desktop.getByRole("link", { name: /Platform/i })).toHaveAttribute(
      "href",
      "/en-US/platform",
    );
  });

  it("shows Platform link as active for authenticated users on platform", () => {
    renderNavbar({ pathname: "/en-US/platform", session: makeSession() });
    const nav = screen.getByRole("navigation");
    const link = within(nav).getAllByRole("link", { name: /Platform/i })[0];
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("renders user trigger and display name when authenticated", () => {
    renderNavbar({ session: makeSession() });
    // The trigger button should exist with aria-label
    expect(screen.getByRole("button", { name: "User menu" })).toBeInTheDocument();
    // Display name shown in dropdown content
    const content = screen.getAllByTestId("dropdown-content")[0];
    expect(within(content).getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("renders account and sign out in desktop dropdown", () => {
    renderNavbar({ session: makeSession() });
    const dropdown = screen.getAllByTestId("dropdown-content")[0];
    expect(within(dropdown).getByRole("link", { name: /Account/i })).toHaveAttribute(
      "href",
      "/en-US/platform/account/settings",
    );
    expect(within(dropdown).getByRole("menuitem", { name: /Sign Out/i })).toBeInTheDocument();
  });

  it("calls signOut on Sign Out click", async () => {
    const user = userEvent.setup();
    renderNavbar({ pathname: "/en-US/blog", session: makeSession() });
    const dropdown = screen.getAllByTestId("dropdown-content")[0];
    await user.click(within(dropdown).getByRole("menuitem", { name: /Sign Out/i }));
    expect(mockSignOutMutateAsync).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("has mobile menu trigger button", () => {
    renderNavbar();
    expect(screen.getByRole("button", { name: /Navigation menu/i })).toBeInTheDocument();
  });

  it("renders header banner", () => {
    renderNavbar();
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("renders mobile nav links with active state", () => {
    renderNavbar({ pathname: "/en-US/about" });
    const dropdowns = screen.getAllByTestId("dropdown-content");
    const mobile = dropdowns[dropdowns.length - 1];
    const aboutLink = within(mobile)
      .getAllByRole("link")
      .find((l) => l.textContent?.includes("About"));
    expect(aboutLink).toHaveAttribute("aria-current", "page");
  });

  it("shows User icon fallback when no avatar", () => {
    renderNavbar({
      session: {
        user: { id: "u-1", email: "test@example.com", image: null, registered: true },
      } as Session,
    });
    expect(screen.getByRole("button", { name: "User menu" })).toBeInTheDocument();
    expect(screen.getAllByText("test@example.com").length).toBeGreaterThan(0);
  });

  it("sets up IntersectionObserver on home page", () => {
    const observeMock = vi.fn();
    const unobserveMock = vi.fn();

    vi.stubGlobal(
      "IntersectionObserver",
      vi.fn((cb: IntersectionObserverCallback) => ({
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
