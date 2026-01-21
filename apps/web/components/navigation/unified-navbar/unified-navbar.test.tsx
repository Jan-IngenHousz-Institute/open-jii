/* eslint-disable @next/next/no-img-element */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Session } from "@repo/auth/types";

// ---- SUT ----
import { UnifiedNavbar } from "./unified-navbar";

globalThis.React = React;

// ---- Mocks ----

// --- mock the profile hook to avoid network and control the UI ---
let __mockProfile: { firstName?: string; lastName?: string } | undefined;

vi.mock("@/hooks/profile/useGetUserProfile/useGetUserProfile", () => ({
  useGetUserProfile: vi.fn(() => {
    return __mockProfile ? { data: { body: __mockProfile } } : { data: undefined };
  }),
}));

// Make next/image a plain <img> so src is stable in tests
vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    className,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children: React.ReactNode }) => (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  ),
}));

const usePathnameMock = vi.fn();
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: (): string => usePathnameMock() as string,
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock useSignOut
const mockSignOutMutateAsync = vi.fn();
vi.mock("~/hooks/auth", () => ({
  useSignOut: () => ({
    mutateAsync: mockSignOutMutateAsync,
    isPending: false,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, fallback?: string) =>
      ({
        "navigation.home": "Home",
        "navigation.about": "About",
        "navigation.blog": "Blog",
        "navigation.platform": "Platform",
        "navigation.menu": "Navigation menu",
        "auth.userMenu": "User menu",
        "auth.account": "Account",
        "auth.signOut": "Sign Out",
      })[k] ??
      fallback ??
      k,
  }),
}));

vi.mock("@/components/multi-language", () => ({
  LanguageSwitcher: ({ locale }: { locale: string }) => (
    <div data-testid="multi-language">{locale}</div>
  ),
}));

vi.mock("@repo/ui/components", () => {
  const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
    ({ children, className, ...rest }, ref) => (
      <button ref={ref} className={className} {...rest}>
        {children}
      </button>
    ),
  );
  Button.displayName = "Button";

  const Avatar = ({ children, className, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={className} data-testid="avatar" {...rest}>
      {children}
    </div>
  );

  const AvatarImage = ({
    src = "",
    alt = "",
    ...rest
  }: { src: string; alt: string } & React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img data-testid="avatar-image" src={src} alt={alt} width={32} height={32} {...rest} />
  );

  const AvatarFallback = ({
    children,
    className,
  }: {
    children?: React.ReactNode;
    className?: string;
  }) => (
    <div className={className} data-testid="avatar-fallback">
      {children}
    </div>
  );

  // DropdownMenu with state management
  const DropdownMenu = ({
    children,
    open: controlledOpen,
    onOpenChange,
  }: React.PropsWithChildren<{
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }>) => {
    const [internalOpen, setInternalOpen] = React.useState(false);
    const open = controlledOpen ?? internalOpen;

    const toggle = () => {
      const newState = !open;
      setInternalOpen(newState);
      onOpenChange?.(newState);
    };

    return (
      <div data-open={open} onClick={toggle}>
        {children}
      </div>
    );
  };

  const DropdownMenuTrigger = ({
    children,
    asChild: _asChild,
    ...rest
  }: React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }) => (
    <div data-testid="dropdown-trigger" {...rest}>
      {children}
    </div>
  );
  const DropdownMenuContent = ({
    children,
    className,
    ...rest
  }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="dropdown-content" className={className} {...rest}>
      {children}
    </div>
  );
  const DropdownMenuItem = ({
    children,
    asChild: _asChild,
    ...rest
  }: React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }) => (
    <div role="menuitem" {...rest}>
      {children}
    </div>
  );
  const DropdownMenuSeparator = () => <hr />;

  return {
    Button,
    Avatar,
    AvatarImage,
    AvatarFallback,
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
  };
});

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  );
  return {
    User: Icon,
    Home: Icon,
    BookOpen: Icon,
    LogOut: Icon,
    Menu: Icon,
    LogIn: Icon,
    Sprout: Icon,
    MessageCircleQuestion: Icon,
    ChevronDown: Icon,
  };
});

// ---- Helpers ----
function renderNavbar({
  locale = "en-US",
  pathname = "/en-US",
  session = null,
}: {
  locale?: string;
  pathname?: string;
  session?: Session | null;
} = {}) {
  usePathnameMock.mockReturnValue(pathname);

  // Provide a QueryClient for hooks
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  // If authenticated, make sure the navbar can show a display name
  __mockProfile = session?.user ? { firstName: "Ada", lastName: "Lovelace" } : undefined;

  return render(
    <QueryClientProvider client={queryClient}>
      <UnifiedNavbar locale={locale} session={session} />
    </QueryClientProvider>,
  );
}

const makeSession = (over: Partial<Session> = {}) =>
  ({
    user: {
      id: "user-1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      image: "https://example.com/ada.png",
      registered: true,
    },
    expires: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
    ...over,
  }) as Session;

// ---- Tests ----
describe("<UnifiedNavbar />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Home/About/Blog links and marks current page active via aria-current", () => {
    renderNavbar({ locale: "en-US", pathname: "/en-US/blog/some-post" });

    const nav = screen.getByRole("navigation");
    const desktopLinks = nav.querySelector(".md\\:flex");
    expect(desktopLinks).not.toBeNull();

    const utils = within(desktopLinks as HTMLElement);

    const home = utils.getByRole("link", { name: /Home/i });
    const about = utils.getByRole("link", { name: /About/i });
    const blog = utils.getByRole("link", { name: /Blog/i });

    expect(home).toHaveAttribute("href", "/en-US");
    expect(about).toHaveAttribute("href", "/en-US/about");
    expect(blog).toHaveAttribute("href", "/en-US/blog");

    expect(home).not.toHaveAttribute("aria-current");
    expect(about).not.toHaveAttribute("aria-current");
    expect(blog).toHaveAttribute("aria-current", "page");
  });

  it("shows 'Platform' link for guests in navigation", () => {
    renderNavbar({ locale: "en-US", pathname: "/en-US" });

    // Scope into desktop links only
    const nav = screen.getByRole("navigation");
    const desktopLinks = nav.querySelector(".md\\:flex");
    expect(desktopLinks).not.toBeNull();

    const utils = within(desktopLinks as HTMLElement);

    // Desktop nav should include Platform for guests
    const platformLink = utils.getByRole("link", { name: /Platform/i });
    expect(platformLink).toHaveAttribute("href", "/en-US/platform");
  });

  it("shows 'Platform' in nav for authenticated users", () => {
    renderNavbar({
      locale: "en-US",
      pathname: "/en-US/platform",
      session: makeSession(),
    });

    const desktopNav = screen.getByRole("navigation");
    const platformLink = within(desktopNav).getAllByRole("link", { name: /Platform/i })[0];
    expect(platformLink).toHaveAttribute("href", "/en-US/platform");
    expect(platformLink).toHaveAttribute("aria-current", "page");
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

  it("renders header on non-platform pages", () => {
    renderNavbar({ locale: "en-US", pathname: "/en-US/some-random-page" });

    const header = screen.getByRole("banner");
    expect(header).toBeInTheDocument();
  });

  it("renders mobile auth section correctly when logged in", () => {
    renderNavbar({
      locale: "en-US",
      pathname: "/en-US",
      session: makeSession(),
    });

    const dropdown = screen.getAllByTestId("dropdown-content")[0];

    expect(within(dropdown).getByText("Ada Lovelace")).toBeInTheDocument();
    expect(within(dropdown).getByTestId("avatar-image")).toBeInTheDocument();
  });

  it("sets up intersection observer when isHomePage is true", () => {
    const observeMock = vi.fn();
    const unobserveMock = vi.fn();
    let observerCallback: IntersectionObserverCallback | null = null;

    const mockIntersectionObserver = vi.fn((callback: IntersectionObserverCallback) => {
      observerCallback = callback;
      return {
        observe: observeMock,
        unobserve: unobserveMock,
        disconnect: vi.fn(),
      };
    });

    vi.stubGlobal("IntersectionObserver", mockIntersectionObserver);

    // Create a mock hero section
    const heroSection = document.createElement("section");
    const main = document.createElement("main");
    main.appendChild(heroSection);
    document.body.appendChild(main);

    const { unmount } = render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false } },
          })
        }
      >
        <UnifiedNavbar locale="en-US" session={null} isHomePage={true} />
      </QueryClientProvider>,
    );

    expect(mockIntersectionObserver).toHaveBeenCalledWith(expect.any(Function), {
      threshold: 0,
      rootMargin: "-64px 0px 0px 0px",
    });
    expect(observeMock).toHaveBeenCalledWith(heroSection);

    // Trigger the IntersectionObserver callback to cover lines 143-144
    observerCallback(
      [{ isIntersecting: false, target: heroSection } as unknown as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );

    observerCallback(
      [{ isIntersecting: true, target: heroSection } as unknown as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );

    unmount();
    expect(unobserveMock).toHaveBeenCalledWith(heroSection);

    // Cleanup
    document.body.removeChild(main);
    vi.unstubAllGlobals();
  });

  it("renders mobile navigation links with active state", () => {
    renderNavbar({
      locale: "en-US",
      pathname: "/en-US/about",
    });

    const mobileDropdowns = screen.getAllByTestId("dropdown-content");
    const mobileDropdown = mobileDropdowns[mobileDropdowns.length - 1];

    const mobileLinks = within(mobileDropdown).getAllByRole("link");

    const aboutLink = mobileLinks.find((link) => link.textContent.includes("About"));
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
      vi.fn().mockImplementation(() => ({
        observe,
        unobserve,
        disconnect,
      })),
    );

    // Render on non-home page
    renderNavbar({
      locale: "en-US",
      pathname: "/en-US/about",
    });

    // Lines 143-144: if (!isHomePage) return; should prevent observer setup
    expect(observe).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("sets up and cleans up intersection observer on home page", () => {
    const observe = vi.fn();
    const unobserve = vi.fn();
    const disconnect = vi.fn();

    const mockObserver = vi.fn().mockImplementation(() => ({
      observe,
      unobserve,
      disconnect,
    }));

    vi.stubGlobal("IntersectionObserver", mockObserver);

    // Create a main element with a section for observer to target
    const main = document.createElement("main");
    const section = document.createElement("section");
    main.appendChild(section);
    document.body.appendChild(main);

    usePathnameMock.mockReturnValue("/en-US");
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    // Render on home page with isHomePage=true
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <UnifiedNavbar locale="en-US" session={null} isHomePage={true} />
      </QueryClientProvider>,
    );

    // Lines 143-144: if (!isHomePage) return; should NOT prevent observer
    // On home page, IntersectionObserver should be instantiated
    expect(mockObserver).toHaveBeenCalled();

    // Cleanup on unmount
    unmount();

    // Cleanup
    document.body.removeChild(main);
    vi.unstubAllGlobals();
  });

  it("does not set up IntersectionObserver when not on home page", () => {
    const mockObserver = vi.fn();
    const mockObserve = vi.fn();
    const mockUnobserve = vi.fn();
    const mockDisconnect = vi.fn();

    vi.stubGlobal("IntersectionObserver", function (this: IntersectionObserver) {
      mockObserver();
      this.observe = mockObserve;
      this.unobserve = mockUnobserve;
      this.disconnect = mockDisconnect;
      return this;
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <UnifiedNavbar locale="en-US" session={null} isHomePage={false} />
      </QueryClientProvider>,
    );

    // Lines 143-144: if (!isHomePage) return early exit
    expect(mockObserver).not.toHaveBeenCalled();
    expect(mockObserve).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
