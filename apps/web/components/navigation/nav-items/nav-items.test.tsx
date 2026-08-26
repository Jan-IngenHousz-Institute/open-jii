import { render, screen, userEvent } from "@/test/test-utils";
import { usePathname } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@repo/ui/components/sidebar";

import { NavItems } from "./nav-items";

const items = [
  { title: "Experiments", url: "/en-US/platform/experiments" },
  { title: "Macros", url: "/en-US/platform/macros" },
  { title: "Dashboard", url: "/en-US/platform" },
];

const groupItems = [
  {
    title: "Library",
    url: "/en-US/platform/protocols",
    navigable: false,
    children: [
      { title: "Protocols", url: "/en-US/platform/protocols" },
      { title: "Macros", url: "/en-US/platform/macros" },
    ],
  },
];

// The rows are stock `SidebarMenuButton`s, which need the provider and which
// carry their active state on `data-active` rather than in a class string.
function renderNav(nav: React.ReactNode) {
  return render(<SidebarProvider>{nav}</SidebarProvider>);
}

describe("NavItems", () => {
  it("renders all items with links", () => {
    renderNav(<NavItems items={items} />);

    for (const item of items) {
      const link = screen.getByText(item.title).closest("a");
      expect(link).toHaveAttribute("href", item.url);
    }
  });

  it("marks exact match as active", () => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/experiments");
    renderNav(<NavItems items={items} />);

    expect(screen.getByText("Experiments").closest("a")).toHaveAttribute("data-active", "true");
  });

  it("marks prefix match as active for deep paths", () => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/experiments/123");
    renderNav(<NavItems items={items} />);

    expect(screen.getByText("Experiments").closest("a")).toHaveAttribute("data-active", "true");
  });

  it("does not mark non-matching items as active", () => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/experiments");
    renderNav(<NavItems items={items} />);

    expect(screen.getByText("Macros").closest("a")).toHaveAttribute("data-active", "false");
  });

  it("does not mark the dashboard active from a deeper platform path", () => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/experiments");
    renderNav(<NavItems items={items} />);

    expect(screen.getByText("Dashboard").closest("a")).toHaveAttribute("data-active", "false");
  });
});

describe("NavItems > NavGroup (children + navigable: false)", () => {
  it("renders the group header as a button, not a link", () => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform");
    renderNav(<NavItems items={groupItems} />);

    const header = screen.getByRole("button", { name: /library/i });
    expect(header).toBeInTheDocument();
    expect(header.tagName).toBe("BUTTON");
  });

  it("hides children by default when no child is active", () => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform");
    renderNav(<NavItems items={groupItems} />);

    expect(screen.queryByText("Protocols")).not.toBeInTheDocument();
    expect(screen.queryByText("Macros")).not.toBeInTheDocument();
  });

  it("toggles children open/closed on header click", async () => {
    const user = userEvent.setup();
    vi.mocked(usePathname).mockReturnValue("/en-US/platform");
    renderNav(<NavItems items={groupItems} />);

    const header = screen.getByRole("button", { name: /library/i });
    await user.click(header);
    expect(screen.getByText("Protocols")).toBeInTheDocument();
    expect(screen.getByText("Macros")).toBeInTheDocument();

    await user.click(header);
    expect(screen.queryByText("Protocols")).not.toBeInTheDocument();
  });

  it("opens by default and marks the active child when pathname matches a child", () => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/macros");
    renderNav(<NavItems items={groupItems} />);

    expect(screen.getByText("Macros").closest("a")).toHaveAttribute("data-active", "true");
    expect(screen.getByText("Protocols").closest("a")).toHaveAttribute("data-active", "false");
  });

  // Active state belongs to the leaf. A parent that also lit up put two rows in a
  // selected state at once.
  it("leaves the group header unselected when a child is active", () => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/macros");
    renderNav(<NavItems items={groupItems} />);

    expect(screen.getByRole("button", { name: /library/i })).toHaveAttribute(
      "data-active",
      "false",
    );
    expect(screen.getByText("Macros").closest("a")).toHaveAttribute("data-active", "true");
  });

  it("treats prefix match on deep child paths as active", () => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/macros/abc");
    renderNav(<NavItems items={groupItems} />);

    expect(screen.getByText("Macros").closest("a")).toHaveAttribute("data-active", "true");
  });
});
