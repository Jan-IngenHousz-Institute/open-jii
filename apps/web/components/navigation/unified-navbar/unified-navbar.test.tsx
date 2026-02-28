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

  it("renders account and sign out in desktop dropdown", () => {
    renderNavbar({ session: makeSession() });
    const dropdown = screen.getAllByTestId("dropdown-content")[0];
    expect(within(dropdown).getByRole("link", { name: /auth\.account/i })).toHaveAttribute(
      "href",
      "/en-US/platform/account/settings",
    );
    expect(within(dropdown).getByRole("menuitem", { name: /auth\.signOut/i })).toBeInTheDocument();
  });

  it("calls signOut on Sign Out click", async () => {
    const user = userEvent.setup();
    const { router } = renderNavbar({ pathname: "/en-US/blog", session: makeSession() });
    const dropdown = screen.getAllByTestId("dropdown-content")[0];
    await user.click(within(dropdown).getByRole("menuitem", { name: /auth\.signOut/i }));
    await waitFor(() => expect(authClient.signOut).toHaveBeenCalled());
    expect(router.push).toHaveBeenCalledWith("/");
  });

  it("has mobile menu trigger button", () => {
    renderNavbar();
    expect(screen.getByRole("button", { name: /navigation\.menu/i })).toBeInTheDocument();
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
      .find((l) => l.textContent?.includes("navigation.about") === true);
    expect(aboutLink).toBeDefined();
    expect(aboutLink).toHaveAttribute("aria-current", "page");
  });

  it("shows User icon fallback when no avatar", () => {
    renderNavbar({
      session: makeSession({ user: { email: "test@example.com", image: null } }),
    });
    expect(screen.getByRole("button", { name: "auth.userMenu" })).toBeInTheDocument();
    expect(screen.getAllByText("test@example.com").length).toBeGreaterThan(0);
  });

  it("sets up IntersectionObserver on home page", () => {
    const observeMock = vi.fn();
    const unobserveMock = vi.fn();

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
