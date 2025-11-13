import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import AccountSettingsLayout from "../layout";

// Global React for JSX in mocks
globalThis.React = React;

// -------------------
// Mocks
// -------------------
const headersMock = vi.fn();
vi.mock("next/headers", () => ({
  headers: () => ({
    get: headersMock,
  }),
}));

vi.mock("@repo/i18n/server", () => ({
  __esModule: true,
  default: () => ({
    t: (key: string) =>
      ({
        "account:overview.title": "Overview",
        "account:settings.title": "Settings",
        "account:security.title": "Security",
        "account:notifications.title": "Notifications",
        "account:team.title": "Team",
        "account:activity.title": "Activity",
        "account:mobileNavAriaLabel": "Mobile navigation",
      })[key] ?? key,
  }),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@repo/ui/components", () => {
  const Button = ({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...rest}>{children}</button>
  );
  const DropdownMenu = ({ children }: React.PropsWithChildren) => <div>{children}</div>;
  const DropdownMenuTrigger = ({ children }: React.PropsWithChildren) => (
    <div data-testid="dropdown-trigger">{children}</div>
  );
  const DropdownMenuContent = ({ children }: React.PropsWithChildren) => (
    <div data-testid="dropdown-content">{children}</div>
  );
  const DropdownMenuItem = ({
    children,
    disabled,
    ...rest
  }: React.HTMLAttributes<HTMLDivElement> & { disabled?: boolean }) => (
    <div role="menuitem" aria-disabled={disabled} {...rest}>
      {children}
    </div>
  );
  return { Button, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem };
});

vi.mock("lucide-react", () => {
  const Icon = () => <span data-testid="icon" />;
  return {
    User: Icon,
    Settings: Icon,
    Shield: Icon,
    Bell: Icon,
    Users: Icon,
    Activity: Icon,
    Menu: Icon,
  };
});

// -------------------
// Helpers
// -------------------
async function renderLayout({
  locale = "en-US",
  pathname = "/en-US/platform/account/settings",
  children = <div>Child Content</div>,
}: {
  locale?: string;
  pathname?: string;
  children?: React.ReactNode;
} = {}) {
  headersMock.mockReturnValue(pathname);
  return render(await AccountSettingsLayout({ params: Promise.resolve({ locale }), children }));
}

// -------------------
// Tests
// -------------------
describe("<AccountSettingsLayout />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders tabs with correct labels in desktop nav", async () => {
    await renderLayout();

    const desktopNav = screen.getByRole("navigation");
    const desktopList = desktopNav.querySelector("ul.md\\:flex");

    expect(
      within(desktopList as HTMLElement).getByRole("link", { name: /Settings/i }),
    ).toBeInTheDocument();
    expect(within(desktopList as HTMLElement).getByText("Overview")).toBeInTheDocument();
    expect(within(desktopList as HTMLElement).getByText("Security")).toBeInTheDocument();
    expect(within(desktopList as HTMLElement).getByText("Notifications")).toBeInTheDocument();
    expect(within(desktopList as HTMLElement).getByText("Team")).toBeInTheDocument();
    expect(within(desktopList as HTMLElement).getByText("Activity")).toBeInTheDocument();
  });

  it("marks the correct tab as active with aria-current in desktop nav", async () => {
    await renderLayout({ pathname: "/en-US/platform/account/settings" });

    const desktopNav = screen.getByRole("navigation");
    const desktopList = desktopNav.querySelector("ul.md\\:flex");

    const settingsLink = within(desktopList as HTMLElement).getByRole("link", {
      name: /Settings/i,
    });
    expect(settingsLink).toHaveAttribute("aria-current", "page");
  });

  it("renders disabled tabs without links in desktop nav", async () => {
    await renderLayout();
    const desktopNav = screen.getByRole("navigation");
    const desktopList = desktopNav.querySelector("ul.md\\:flex");

    const overview = within(desktopList as HTMLElement)
      .getByText("Overview")
      .closest("div");
    expect(overview?.tagName).toBe("DIV");
    expect(overview).toHaveClass("cursor-not-allowed", { exact: false });
  });

  it("renders children content", async () => {
    await renderLayout({ children: <div>Test Content</div> });
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("renders mobile dropdown with active tab", async () => {
    await renderLayout({ pathname: "/en-US/platform/account/settings" });

    const trigger = screen.getByTestId("dropdown-trigger");
    expect(within(trigger).getByText("Settings")).toBeInTheDocument();

    const dropdown = screen.getByTestId("dropdown-content");
    expect(within(dropdown).getByRole("menuitem", { name: /Overview/i })).toBeInTheDocument();
  });
});
