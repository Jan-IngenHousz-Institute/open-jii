import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { DashboardSection } from "./dashboard-section";
import { SeeAllLink } from "./see-all-link";

describe("DashboardSection", () => {
  it("names the section by its heading and renders its content", () => {
    render(
      <DashboardSection id="recent" title="Recent" meta="2 unread">
        <p>Child content</p>
      </DashboardSection>,
    );

    expect(screen.getByRole("region", { name: /Recent/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recent 2 unread" })).toBeInTheDocument();
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("puts the action beside the heading", () => {
    render(
      <DashboardSection
        id="projects"
        title="Projects"
        action={<SeeAllLink href="/en-US/projects">View all</SeeAllLink>}
      >
        <div />
      </DashboardSection>,
    );

    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute(
      "href",
      "/en-US/projects",
    );
  });
});
