import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { PageHeader } from "../page-header";

describe("PageHeader", () => {
  it("renders the title as the page heading", () => {
    render(<PageHeader title="Macros" />);
    expect(screen.getByRole("heading", { level: 1, name: "Macros" })).toBeInTheDocument();
  });

  it("uses the index scale at level page and the section scale below it", () => {
    const { container: page } = render(<PageHeader title="Macros" />);
    expect(page.querySelector("h1")).toHaveClass("text-4xl");

    const { container: section } = render(<PageHeader title="Dashboards" level="section" />);
    expect(section.querySelector("h1")).toHaveClass("text-2xl", "tracking-tight");
  });

  it("renders description, actions and extra children", () => {
    render(
      <PageHeader
        title="Macros"
        description="Reusable analysis code"
        actions={<button type="button">New macro</button>}
      >
        <span>Archive link</span>
      </PageHeader>,
    );

    expect(screen.getByText("Reusable analysis code")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New macro" })).toBeInTheDocument();
    expect(screen.getByText("Archive link")).toBeInTheDocument();
  });

  it("omits the actions wrapper when there are none", () => {
    const { container } = render(<PageHeader title="Macros" />);
    expect(container.firstElementChild?.children).toHaveLength(1);

    const { container: withActions } = render(
      <PageHeader title="Macros" actions={<button type="button">New</button>} />,
    );
    expect(withActions.firstElementChild?.children).toHaveLength(2);
  });
});
