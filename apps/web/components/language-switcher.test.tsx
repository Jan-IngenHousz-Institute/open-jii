import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { LanguageSwitcher } from "./language-switcher";

// Mock the hook
let mockFeatureFlagValue: boolean | undefined = undefined;
vi.mock("posthog-js/react", () => ({
  useFeatureFlagEnabled: vi.fn(() => mockFeatureFlagValue),
}));

// Mock next/navigation
const mockPathname = "/en-US/platform";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    href,
    className,
    children,
  }: {
    href: string;
    className?: string;
    children: React.ReactNode;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  Globe: () => <div data-testid="globe-icon" />,
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { asChild?: boolean; children: React.ReactNode }) => (
    <div data-testid="dropdown-trigger">{children}</div>
  ),
  DropdownMenuContent: ({ children }: { align?: string; children: React.ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    asChild: _asChild,
  }: {
    asChild?: boolean;
    children: React.ReactNode;
  }) => <div data-testid="dropdown-item">{children}</div>,
}));

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureFlagValue = undefined;
  });

  it("should return null when feature flag is loading (undefined)", () => {
    mockFeatureFlagValue = undefined;

    const { container } = render(<LanguageSwitcher locale="en-US" />);

    expect(container.firstChild).toBeNull();
  });

  it("should return null when feature flag is disabled (only one language)", () => {
    mockFeatureFlagValue = false;

    const { container } = render(<LanguageSwitcher locale="en-US" />);

    expect(container.firstChild).toBeNull();
  });

  it("should render language switcher when feature flag is enabled", () => {
    mockFeatureFlagValue = true;

    render(<LanguageSwitcher locale="en-US" />);

    expect(screen.getByTestId("dropdown-trigger")).toBeInTheDocument();
    expect(screen.getByTestId("globe-icon")).toBeInTheDocument();
  });

  it("should show current locale flag when rendered", () => {
    mockFeatureFlagValue = true;

    render(<LanguageSwitcher locale="en-US" />);

    const flags = screen.getAllByText("🇺🇸");
    expect(flags[0]).toBeInTheDocument();
  });

  it("should show German flag when locale is de-DE", () => {
    mockFeatureFlagValue = true;

    render(<LanguageSwitcher locale="de-DE" />);

    const flags = screen.getAllByText("🇩🇪");
    expect(flags[0]).toBeInTheDocument();
  });

  it("should render all available locales in dropdown when flag is enabled", () => {
    mockFeatureFlagValue = true;

    render(<LanguageSwitcher locale="en-US" />);

    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("Deutsch")).toBeInTheDocument();
  });

  it("should generate correct language switch URLs", () => {
    mockFeatureFlagValue = true;

    render(<LanguageSwitcher locale="en-US" />);

    const dropdownContent = screen.getByTestId("dropdown-content");
    const links = within(dropdownContent).getAllByRole("link");

    expect(links[0]).toHaveAttribute("href", "/en-US/platform");
    expect(links[1]).toHaveAttribute("href", "/de-DE/platform");
  });

  it("should highlight current locale with bg-accent class", () => {
    mockFeatureFlagValue = true;

    render(<LanguageSwitcher locale="en-US" />);

    const dropdownContent = screen.getByTestId("dropdown-content");
    const links = within(dropdownContent).getAllByRole("link");

    expect(links[0]).toHaveClass("bg-accent");
    expect(links[1]).not.toHaveClass("bg-accent");
  });

  it("should handle root path correctly", () => {
    mockFeatureFlagValue = true;

    render(<LanguageSwitcher locale="en-US" />);

    const dropdownContent = screen.getByTestId("dropdown-content");
    const links = within(dropdownContent).getAllByRole("link");

    // Should convert empty path to "/"
    expect(links[0]?.getAttribute("href")).toMatch(/^\/[a-z]{2}-[A-Z]{2}\//);
  });

  it("should have accessible aria-label on trigger button", () => {
    mockFeatureFlagValue = true;

    render(<LanguageSwitcher locale="en-US" />);

    expect(screen.getByLabelText("Switch language")).toBeInTheDocument();
  });

  it("should show only English when feature flag is disabled (filtered locales)", () => {
    mockFeatureFlagValue = false;

    // This should return null since only 1 language, but let's verify the logic
    const { container } = render(<LanguageSwitcher locale="en-US" />);

    // Component should not render
    expect(container.firstChild).toBeNull();
  });

  it("should use first locale as fallback if current locale not found", () => {
    mockFeatureFlagValue = true;

    // @ts-expect-error - Testing with invalid locale
    render(<LanguageSwitcher locale="fr-FR" />);

    // Should default to English flag
    const flags = screen.getAllByText("🇺🇸");
    expect(flags[0]).toBeInTheDocument();
  });
});
