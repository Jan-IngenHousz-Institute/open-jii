import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { FlaskConical } from "lucide-react";
import { usePathname } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import { SidebarProvider, useSidebar } from "@repo/ui/components/sidebar";

import { NavItems } from "./nav-items";

const items = [
  { title: "Experiments", url: "/en-US/platform/experiments", icon: FlaskConical },
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

function MobileDrawerState() {
  const { isMobile, openMobile, setOpenMobile } = useSidebar();

  return (
    <>
      <span data-testid="is-mobile">{String(isMobile)}</span>
      <span data-testid="mobile-drawer-state">{openMobile ? "open" : "closed"}</span>
      <button type="button" onClick={() => setOpenMobile(true)}>
        Open mobile drawer
      </button>
    </>
  );
}

describe("NavItems", () => {
  it("renders all items with links", () => {
    renderNav(<NavItems items={items} />);

    for (const item of items) {
      const link = screen.getByText(item.title).closest("a");
      expect(link).toHaveAttribute("href", item.url);
    }
  });

  it("keeps navigation icons visible on desktop and mobile", () => {
    renderNav(<NavItems items={items} />);

    const experimentsLink = screen.getByRole("link", { name: "Experiments" });
    expect(experimentsLink.querySelector("svg")).not.toHaveClass("md:hidden");
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

  it("closes the mobile drawer immediately when a navigation link is selected", async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = (query: string) => ({
      matches: query.includes("max-width"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    try {
      const user = userEvent.setup();
      renderNav(
        <>
          <MobileDrawerState />
          <NavItems items={items} />
        </>,
      );

      await waitFor(() => expect(screen.getByTestId("is-mobile")).toHaveTextContent("true"));
      await user.click(screen.getByRole("button", { name: "Open mobile drawer" }));
      expect(screen.getByTestId("mobile-drawer-state")).toHaveTextContent("open");

      const experimentsLink = screen.getByRole("link", { name: "Experiments" });
      experimentsLink.addEventListener("click", (event) => event.preventDefault());
      await user.click(experimentsLink);
      expect(screen.getByTestId("mobile-drawer-state")).toHaveTextContent("closed");
    } finally {
      window.matchMedia = originalMatchMedia;
    }
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
