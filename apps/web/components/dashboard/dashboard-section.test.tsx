import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { DashboardSection } from "./dashboard-section";

globalThis.React = React;

describe("<DashboardSection />", () => {
  it("renders title and children", () => {
    render(
      <DashboardSection
        title="Recent Posts"
        seeAllLabel="See all"
        seeAllHref="/all-posts"
        locale="en-US"
      >
        <div data-testid="child">Hello Child</div>
      </DashboardSection>,
    );

    expect(screen.getByText("Recent Posts")).toBeInTheDocument();
    expect(screen.getByTestId("child")).toHaveTextContent("Hello Child");
  });

  it("renders link with correct href and label", () => {
    render(
      <DashboardSection
        title="Projects"
        seeAllLabel="View all projects"
        seeAllHref="/projects"
        locale="en-US"
      >
        <div />
      </DashboardSection>,
    );

    const link = screen.getByRole("link", { name: "View all projects" });
    expect(link).toHaveAttribute("href", "/projects");
  });
});
