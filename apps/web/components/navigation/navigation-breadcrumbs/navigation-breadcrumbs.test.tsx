import { render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { Breadcrumbs } from "./navigation-breadcrumbs";

const { enrichPathSegmentsMock } = vi.hoisted(() => ({
  enrichPathSegmentsMock: vi.fn(),
}));

vi.mock("~/app/actions/breadcrumbs", () => ({
  enrichPathSegments: enrichPathSegmentsMock,
}));

describe("Breadcrumbs", () => {
  it("renders nothing when no segments", async () => {
    enrichPathSegmentsMock.mockResolvedValue([]);

    render(<Breadcrumbs locale="en-US" />);

    await waitFor(() => {
      expect(screen.queryByRole("navigation", { name: "breadcrumb" })).not.toBeInTheDocument();
    });
  });

  it("renders breadcrumb segments", async () => {
    enrichPathSegmentsMock.mockResolvedValue([
      { segment: "platform", href: "/en-US/platform", title: "platform" },
      { segment: "experiments", href: "/en-US/platform/experiments", title: "experiments" },
    ]);

    render(<Breadcrumbs locale="en-US" />);

    await waitFor(() => {
      expect(screen.getByText("breadcrumbs.platform")).toBeInTheDocument();
    });
    expect(screen.getByText("breadcrumbs.experiments")).toBeInTheDocument();
  });

  it("uses enriched title when different from segment", async () => {
    enrichPathSegmentsMock.mockResolvedValue([
      { segment: "experiments", href: "/en-US/platform/experiments", title: "My Experiment" },
    ]);

    render(<Breadcrumbs locale="en-US" />);

    await waitFor(() => {
      expect(screen.getByText("My Experiment")).toBeInTheDocument();
    });
  });

  it("handles dashed segments as title case", async () => {
    enrichPathSegmentsMock.mockResolvedValue([
      { segment: "my-project", href: "/en-US/platform/my-project", title: "my-project" },
    ]);

    render(<Breadcrumbs locale="en-US" />);

    await waitFor(() => {
      expect(screen.getByText("My Project")).toBeInTheDocument();
    });
  });
});
