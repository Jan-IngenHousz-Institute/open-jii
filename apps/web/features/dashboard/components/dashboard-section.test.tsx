import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { DashboardSection } from "./dashboard-section";

describe("DashboardSection", () => {
  it("renders title and children", () => {
    render(
      <DashboardSection title="Recent" seeAllLabel="See all" seeAllHref="/all" locale="en-US">
        <p>Child content</p>
      </DashboardSection>,
    );

    expect(screen.getByRole("heading", { name: "Recent" })).toBeInTheDocument();
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("renders see-all links with correct href", () => {
    render(
      <DashboardSection
        title="Projects"
        seeAllLabel="View all"
        seeAllHref="/projects"
        locale="en-US"
      >
        <div />
      </DashboardSection>,
    );

    const links = screen.getAllByRole("link", { name: "View all" });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/projects");
    }
  });
});
