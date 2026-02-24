import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { NavItems } from "./nav-items";

const mockUsePathname = vi.fn().mockReturnValue("/en-US/platform");

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => mockUsePathname(),
}));

const items = [
  { title: "Experiments", url: "/en-US/platform/experiments" },
  { title: "Macros", url: "/en-US/platform/macros" },
  { title: "Dashboard", url: "/en-US/platform" },
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
    mockUsePathname.mockReturnValue("/en-US/platform/experiments");
    render(<NavItems items={items} />);

    const link = screen.getByText("Experiments").closest("a");
    expect(link?.className).toContain("font-semibold");
  });

  it("marks prefix match as active for deep paths", () => {
    mockUsePathname.mockReturnValue("/en-US/platform/experiments/123");
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
