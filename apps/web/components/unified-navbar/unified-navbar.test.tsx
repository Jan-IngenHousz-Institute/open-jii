/* eslint-disable @next/next/no-img-element */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Session } from "@repo/auth/types";
import type { Locale } from "@repo/i18n";

// ---- SUT ----
import { UnifiedNavbar } from "./unified-navbar";

globalThis.React = React;

// ---- Mocks ----

// --- mock the profile hook to avoid network and control the UI ---
let __mockProfile: { firstName?: string; lastName?: string } | undefined;

vi.mock("../../hooks/profile/useGetUserProfile/useGetUserProfile", () => ({
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
vi.mock("next/navigation", () => ({
  usePathname: (): string => usePathnameMock() as string,
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
  const Button = ({
    children,
    className,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button className={className} {...rest}>
      {children}
    </button>
  );

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

  // DropdownMenu primitives: render children directly to keep content in DOM
  const DropdownMenu = ({ children }: React.PropsWithChildren<object>) => <div>{children}</div>;
  const DropdownMenuTrigger = ({ children, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
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
  const DropdownMenuItem = ({ children, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
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
  };
});

// ---- Helpers ----
function renderNavbar({
  locale = "en-US",
  pathname = "/en-US",
  session = null,
}: {
  locale?: Locale;
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

    expect(within(trigger).getByText("Ada Lovelace")).toBeInTheDocument();
    const avatarImage = screen.getAllByTestId("avatar-image")[0];
    expect(avatarImage).toHaveAttribute("src", "https://example.com/ada.png");
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

    const signOutLink = within(desktopDropdown).getByRole("link", { name: /Sign Out/i });
    expect(signOutLink).toBeInTheDocument();
  });

  it("navigates to signout page when sign out is clicked", () => {
    renderNavbar({
      locale: "en-US",
      pathname: "/en-US/blog",
      session: makeSession(),
    });

    const desktopDropdown = screen.getAllByTestId("dropdown-content")[0];
    const signOutLink = within(desktopDropdown).getByRole("link", { name: /Sign Out/i });

    expect(signOutLink).toHaveAttribute("href", "/en-US/platform/signout?hideBackground=true");
  });

  it("navigates to signout page when currently on /platform", () => {
    renderNavbar({
      locale: "en-US",
      pathname: "/en-US/platform",
      session: makeSession(),
    });

    const desktopDropdown = screen.getAllByTestId("dropdown-content")[0];
    const signOutLink = within(desktopDropdown).getByRole("link", { name: /Sign Out/i });

    expect(signOutLink).toHaveAttribute("href", "/en-US/platform/signout?hideBackground=true");
  });

  it("mobile menu trigger is present (icon button)", () => {
    renderNavbar({ locale: "en-US", pathname: "/en-US" });
    expect(screen.getByRole("button", { name: /Navigation menu/i })).toBeInTheDocument();
  });
});
