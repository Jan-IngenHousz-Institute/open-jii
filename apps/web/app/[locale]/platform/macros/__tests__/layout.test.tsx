/* eslint-disable @typescript-eslint/no-unsafe-return */
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Locale } from "@repo/i18n";

import MacroLayout from "../[id]/layout";

// Global React for JSX in mocks
globalThis.React = React;

// -------------------
// Mocks
// -------------------
const mockUsePathname = vi.fn();
const mockUseParams = vi.fn();
const mockUseLocale = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useParams: () => mockUseParams(),
}));

vi.mock("@/hooks/useLocale", () => ({
  useLocale: () => mockUseLocale(),
}));

vi.mock("@repo/i18n", () => ({
  __esModule: true,
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    locale,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: React.ReactNode;
    locale?: string;
  }) => (
    <a href={href} data-locale={locale} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@repo/ui/components", () => {
  const Tabs = ({
    children,
    value,
    className,
  }: React.PropsWithChildren<{ value?: string; className?: string }>) => (
    <div data-testid="tabs" data-value={value} className={className}>
      {children}
    </div>
  );

  const TabsList = ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <div data-testid="tabs-list" className={className} role="tablist">
      {children}
    </div>
  );

  const TabsTrigger = ({
    children,
    value,
    asChild,
    ...rest
  }: React.PropsWithChildren<{
    value?: string;
    asChild?: boolean;
  }>) => {
    if (asChild && React.isValidElement(children)) {
      const childElement = children as React.ReactElement<Record<string, unknown>>;
      return React.cloneElement(childElement, {
        ...rest,
        "data-testid": "tabs-trigger",
        "data-value": value,
        role: "tab",
        ...childElement.props,
      } as Record<string, unknown>);
    }
    return (
      <button data-testid="tabs-trigger" data-value={value} role="tab" {...rest}>
        {children}
      </button>
    );
  };

  return { Tabs, TabsList, TabsTrigger };
});

// -------------------
// Helpers
// -------------------
function renderLayout({
  locale = "en-US",
  pathname = "/en-US/platform/macros/test-macro-id",
  macroId = "test-macro-id",
  children = <div>Child Content</div>,
}: {
  locale?: Locale;
  pathname?: string;
  macroId?: string;
  children?: React.ReactNode;
} = {}) {
  mockUsePathname.mockReturnValue(pathname);
  mockUseParams.mockReturnValue({ id: macroId });
  mockUseLocale.mockReturnValue(locale);

  return render(<MacroLayout>{children}</MacroLayout>);
}

// -------------------
// Tests
// -------------------
describe("<MacroLayout />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Header Content", () => {
    it("renders macro title and description", () => {
      renderLayout();

      expect(screen.getByText("macros.macro")).toBeInTheDocument();
      expect(screen.getByText("macros.manageMacroDescription")).toBeInTheDocument();
    });
  });

  describe("Tab Navigation", () => {
    it("renders tabs with correct labels", () => {
      renderLayout();

      const tabsList = screen.getByTestId("tabs-list");
      expect(within(tabsList).getByRole("tab", { name: /macros\.overview/i })).toBeInTheDocument();
      expect(
        within(tabsList).getByRole("tab", { name: /navigation\.settings/i }),
      ).toBeInTheDocument();
    });

    it("renders overview tab as active when on overview page", () => {
      renderLayout({
        pathname: "/en-US/platform/macros/test-macro-id",
      });

      const tabs = screen.getByTestId("tabs");
      expect(tabs).toHaveAttribute("data-value", "overview");
    });

    it("renders settings tab as active when on settings page", () => {
      renderLayout({
        pathname: "/en-US/platform/macros/test-macro-id/settings",
      });

      const tabs = screen.getByTestId("tabs");
      expect(tabs).toHaveAttribute("data-value", "settings");
    });

    it("defaults to overview tab for unknown paths", () => {
      renderLayout({
        pathname: "/en-US/platform/macros/test-macro-id/unknown",
      });

      const tabs = screen.getByTestId("tabs");
      expect(tabs).toHaveAttribute("data-value", "overview");
    });
  });

  describe("Tab Links", () => {
    it("renders overview tab with correct href and locale", () => {
      renderLayout({
        locale: "en-US",
        macroId: "test-macro-id",
      });

      const overviewLink = screen.getByRole("tab", { name: /macros\.overview/i });
      expect(overviewLink).toHaveAttribute("href", "/platform/macros/test-macro-id");
      expect(overviewLink).toHaveAttribute("data-locale", "en-US");
    });

    it("renders settings tab with correct href and locale", () => {
      renderLayout({
        locale: "en-US",
        macroId: "test-macro-id",
      });

      const settingsLink = screen.getByRole("tab", { name: /navigation\.settings/i });
      expect(settingsLink).toHaveAttribute("href", "/platform/macros/test-macro-id/settings");
      expect(settingsLink).toHaveAttribute("data-locale", "en-US");
    });

    it("handles different locale in links", () => {
      renderLayout({
        locale: "de-DE",
        macroId: "another-macro-id",
      });

      const overviewLink = screen.getByRole("tab", { name: /macros\.overview/i });
      const settingsLink = screen.getByRole("tab", { name: /navigation\.settings/i });

      expect(overviewLink).toHaveAttribute("href", "/platform/macros/another-macro-id");
      expect(overviewLink).toHaveAttribute("data-locale", "de-DE");
      expect(settingsLink).toHaveAttribute("href", "/platform/macros/another-macro-id/settings");
      expect(settingsLink).toHaveAttribute("data-locale", "de-DE");
    });
  });

  describe("Content Rendering", () => {
    it("renders children content", () => {
      renderLayout({ children: <div>Test Content</div> });

      expect(screen.getByText("Test Content")).toBeInTheDocument();
    });

    it("renders children within correct container", () => {
      renderLayout({ children: <div data-testid="child-content">Child Content</div> });

      const childContent = screen.getByTestId("child-content");
      const container = childContent.parentElement;

      expect(container).toHaveClass("mx-4", "mt-6");
    });
  });

  describe("Responsive Layout", () => {
    it("renders tabs with grid layout for mobile responsiveness", () => {
      renderLayout();

      const tabsList = screen.getByTestId("tabs-list");
      expect(tabsList).toHaveClass("grid", "w-full", "grid-cols-2");
    });

    it("renders tabs container with full width", () => {
      renderLayout();

      const tabs = screen.getByTestId("tabs");
      expect(tabs).toHaveClass("w-full");
    });
  });

  describe("Component Structure", () => {
    it("renders with proper spacing and layout classes", () => {
      const { container } = renderLayout();

      const mainContainer = container.firstChild;
      expect(mainContainer).toHaveClass("space-y-6");
    });

    it("renders header section with proper structure", () => {
      renderLayout();

      const title = screen.getByText("macros.macro");
      const description = screen.getByText("macros.manageMacroDescription");

      expect(title.tagName).toBe("H3");
      expect(title).toHaveClass("text-lg", "font-medium");
      expect(description.tagName).toBe("P");
      expect(description).toHaveClass("text-muted-foreground", "text-sm");
    });
  });

  describe("Active Tab Logic", () => {
    it.each([
      { pathname: "/platform/macros/123", expected: "overview" },
      { pathname: "/en-US/platform/macros/456", expected: "overview" },
      { pathname: "/platform/macros/789/settings", expected: "settings" },
      { pathname: "/en-US/platform/macros/abc/settings", expected: "settings" },
      { pathname: "/platform/macros/def/other", expected: "overview" },
    ])("determines active tab correctly for pathname $pathname", ({ pathname, expected }) => {
      renderLayout({ pathname });

      const tabs = screen.getByTestId("tabs");
      expect(tabs).toHaveAttribute("data-value", expected);
    });
  });
});
