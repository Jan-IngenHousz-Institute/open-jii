import type { BreadcrumbSegment } from "@/lib/breadcrumbs/getBreadcrumbTrail";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { Breadcrumbs } from "./navigation-breadcrumbs";

const { useBreadcrumbsMock } = vi.hoisted(() => ({
  useBreadcrumbsMock: vi.fn<(locale: string) => BreadcrumbSegment[]>(),
}));

vi.mock("@/hooks/breadcrumbs/useBreadcrumbs", () => ({
  useBreadcrumbs: useBreadcrumbsMock,
}));

describe("Breadcrumbs", () => {
  it("renders nothing when there is no trail (section roots)", () => {
    // No empty row is reserved, so the page heading isn't pushed down.
    useBreadcrumbsMock.mockReturnValue([]);

    render(<Breadcrumbs locale="en-US" />);

    expect(screen.queryByRole("navigation", { name: "breadcrumb" })).toBeNull();
  });

  it("renders each crumb as a navigable link", () => {
    useBreadcrumbsMock.mockReturnValue([
      { segment: "experiments", href: "/en-US/platform/experiments", title: "experiments" },
    ]);

    render(<Breadcrumbs locale="en-US" />);

    const link = screen.getByRole("link", { name: "breadcrumbs.experiments" });
    expect(link).toHaveAttribute("href", "/en-US/platform/experiments");
  });

  it("title-cases dashed segments without a translation key", () => {
    useBreadcrumbsMock.mockReturnValue([
      { segment: "my-project", href: "/en-US/platform/my-project", title: "my-project" },
    ]);

    render(<Breadcrumbs locale="en-US" />);

    expect(screen.getByText("My Project")).toBeInTheDocument();
  });
});
