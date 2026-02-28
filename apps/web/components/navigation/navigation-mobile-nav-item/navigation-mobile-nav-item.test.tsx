import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { NavigationMobileNavItem } from "./navigation-mobile-nav-item";

describe("NavigationMobileNavItem", () => {
  const mockOnItemClick = vi.fn();
  const locale = "en";

  it("renders internal link correctly", () => {
    const item = {
      titleKey: "auth.account",
      namespace: "auth",
      url: (locale: string) => `/${locale}/platform/account/settings`,
      icon: "User",
    };

    render(<NavigationMobileNavItem item={item} locale={locale} onItemClick={mockOnItemClick} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/en/platform/account/settings");
    expect(link).not.toHaveAttribute("target");
    expect(screen.getByText("auth.account")).toBeInTheDocument();
  });

  it("renders external link correctly", () => {
    const item = {
      titleKey: "navigation.support",
      namespace: "navigation",
      url: (_locale: string) => "https://docs.openjii.org",
      icon: "LifeBuoy",
      external: true,
    };

    render(<NavigationMobileNavItem item={item} locale={locale} onItemClick={mockOnItemClick} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://docs.openjii.org");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("navigation.support")).toBeInTheDocument();
  });

  it("renders with correct translation", () => {
    const item = {
      titleKey: "navigation.faq",
      namespace: "navigation",
      url: (locale: string) => `/${locale}/faq`,
      icon: "HelpCircle",
    };

    render(<NavigationMobileNavItem item={item} locale={locale} onItemClick={mockOnItemClick} />);

    expect(screen.getByText("navigation.faq")).toBeInTheDocument();
  });
});
