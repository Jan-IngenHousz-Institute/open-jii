import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { Breadcrumbs } from "./navigation-breadcrumbs";

const mockUseBreadcrumbs = vi.fn();
vi.mock("@/hooks/breadcrumbs/useBreadcrumbs", () => ({
  useBreadcrumbs: (...args: unknown[]) => mockUseBreadcrumbs(...args),
}));

describe("Breadcrumbs", () => {
  it("returns null when no segments", () => {
    mockUseBreadcrumbs.mockReturnValue({ data: [] });
    const { container } = render(<Breadcrumbs locale="en-US" />);

    expect(container.firstChild).toBeNull();
  });

  it("returns null when data is undefined", () => {
    mockUseBreadcrumbs.mockReturnValue({ data: undefined });
    const { container } = render(<Breadcrumbs locale="en-US" />);

    expect(container.firstChild).toBeNull();
  });

  it("renders breadcrumb segments", () => {
    mockUseBreadcrumbs.mockReturnValue({
      data: [
        { segment: "platform", href: "/en-US/platform", title: "platform" },
        { segment: "experiments", href: "/en-US/platform/experiments", title: "experiments" },
      ],
    });

    render(<Breadcrumbs locale="en-US" />);

    expect(screen.getByText("breadcrumbs.platform")).toBeInTheDocument();
    expect(screen.getByText("breadcrumbs.experiments")).toBeInTheDocument();
  });

  it("uses enriched title when different from segment", () => {
    mockUseBreadcrumbs.mockReturnValue({
      data: [
        { segment: "experiments", href: "/en-US/platform/experiments", title: "My Experiment" },
      ],
    });

    render(<Breadcrumbs locale="en-US" />);

    expect(screen.getByText("My Experiment")).toBeInTheDocument();
  });

  it("handles dashed segments as title case", () => {
    mockUseBreadcrumbs.mockReturnValue({
      data: [{ segment: "my-project", href: "/en-US/platform/my-project", title: "my-project" }],
    });

    render(<Breadcrumbs locale="en-US" />);

    expect(screen.getByText("My Project")).toBeInTheDocument();
  });
});
