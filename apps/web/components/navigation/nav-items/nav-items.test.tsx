import { render, screen, userEvent } from "@/test/test-utils";
import { usePathname } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

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

describe("NavItems", () => {
  it("renders all items with links", () => {
    render(<NavItems items={items} />);

    for (const item of items) {
      const link = screen.getByText(item.title).closest("a");
      expect(link).toHaveAttribute("href", item.url);
    }
  });

  it("marks exact match as active", () => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/experiments");
    render(<NavItems items={items} />);

    const link = screen.getByText("Experiments").closest("a");
    expect(link?.className).toContain("font-semibold");
  });

  it("marks prefix match as active for deep paths", () => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/experiments/123");
    render(<NavItems items={items} />);

    const link = screen.getByText("Experiments").closest("a");
    expect(link?.className).toContain("font-semibold");
  });

  it("does not mark non-matching items as active", () => {
    render(<NavItems items={items} />);

    const link = screen.getByText("Macros").closest("a");
    expect(link?.className).toContain("font-medium");
    expect(link?.className).not.toContain("font-semibold");
  });
});

describe("NavItems > NavGroup (children + navigable: false)", () => {
  it("renders the group header as a button, not a link", () => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform");
    render(<NavItems items={groupItems} />);

    const header = screen.getByRole("button", { name: /library/i });
    expect(header).toBeInTheDocument();
    expect(header.tagName).toBe("BUTTON");
  });

  it("hides children by default when no child is active", () => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform");
    render(<NavItems items={groupItems} />);

    expect(screen.queryByText("Protocols")).not.toBeInTheDocument();
    expect(screen.queryByText("Macros")).not.toBeInTheDocument();
  });

  it("toggles children open/closed on header click", async () => {
    const user = userEvent.setup();
    vi.mocked(usePathname).mockReturnValue("/en-US/platform");
    render(<NavItems items={groupItems} />);

    const header = screen.getByRole("button", { name: /library/i });
    await user.click(header);
    expect(screen.getByText("Protocols")).toBeInTheDocument();
    expect(screen.getByText("Macros")).toBeInTheDocument();

    await user.click(header);
    expect(screen.queryByText("Protocols")).not.toBeInTheDocument();
  });

  it("opens by default and marks the active child when pathname matches a child", () => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/macros");
    render(<NavItems items={groupItems} />);

    expect(screen.getByText("Macros")).toBeInTheDocument();
    const activeLink = screen.getByText("Macros").closest("a");
    expect(activeLink?.className).toContain("font-semibold");

    const inactiveLink = screen.getByText("Protocols").closest("a");
    expect(inactiveLink?.className).toContain("font-medium");
    expect(inactiveLink?.className).not.toContain("font-semibold");
  });

  it("marks group header as active styling when any child is active", () => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/macros");
    render(<NavItems items={groupItems} />);

    const header = screen.getByRole("button", { name: /library/i });
    expect(header.className).toContain("font-semibold");
  });

  it("treats prefix match on deep child paths as active", () => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/macros/abc");
    render(<NavItems items={groupItems} />);

    const activeLink = screen.getByText("Macros").closest("a");
    expect(activeLink?.className).toContain("font-semibold");
  });
});
