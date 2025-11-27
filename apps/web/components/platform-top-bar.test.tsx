import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { PlatformTopBar } from "./platform-top-bar";

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock Next.js Image
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

// Mock Next.js Link
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  Bell: () => <div data-testid="bell-icon" />,
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
  Separator: () => <div data-testid="separator" />,
  SidebarTrigger: () => <button data-testid="sidebar-trigger">Toggle</button>,
}));

// Mock child components
vi.mock("./language-switcher", () => ({
  LanguageSwitcher: ({ locale }: { locale: string }) => (
    <div data-testid="language-switcher" data-locale={locale} />
  ),
}));

vi.mock("./nav-user/nav-user", () => ({
  NavUser: ({ user, locale }: { user: { email: string }; locale: string }) => (
    <div data-testid="nav-user" data-locale={locale} data-email={user.email} />
  ),
}));

describe("PlatformTopBar", () => {
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    image: "/avatar.jpg",
  };

  it("renders the component with all main elements", () => {
    render(<PlatformTopBar locale="en" user={mockUser} />);

    expect(screen.getByTestId("sidebar-trigger")).toBeInTheDocument();
    expect(screen.getByAltText("JII Logo")).toBeInTheDocument();
    expect(screen.getByTestId("bell-icon")).toBeInTheDocument();
    expect(screen.getByTestId("language-switcher")).toBeInTheDocument();
    expect(screen.getByTestId("nav-user")).toBeInTheDocument();
  });

  it("renders logo with link to platform root", () => {
    render(<PlatformTopBar locale="en" user={mockUser} />);

    const logoLink = screen.getByAltText("JII Logo").closest("a");
    expect(logoLink).toHaveAttribute("href", "/en/platform");
  });

  it("passes locale to child components", () => {
    render(<PlatformTopBar locale="de" user={mockUser} />);

    expect(screen.getByTestId("language-switcher")).toHaveAttribute("data-locale", "de");
    expect(screen.getByTestId("nav-user")).toHaveAttribute("data-locale", "de");
  });

  it("passes user data to NavUser component", () => {
    render(<PlatformTopBar locale="en" user={mockUser} />);

    expect(screen.getByTestId("nav-user")).toHaveAttribute("data-email", "test@example.com");
  });

  it("renders notification button as disabled", () => {
    render(<PlatformTopBar locale="en" user={mockUser} />);

    const notificationButton = screen.getByLabelText("common.common.notifications");
    expect(notificationButton).toBeDisabled();
  });
});
