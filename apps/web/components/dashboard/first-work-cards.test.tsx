import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { FirstWorkCards } from "./first-work-cards";

describe("FirstWorkCards", () => {
  it("links each starting point to a page that exists", () => {
    render(<FirstWorkCards />);

    expect(screen.getByRole("link", { name: /dashboard.firstWork.create.title/ })).toHaveAttribute(
      "href",
      "/en-US/platform/experiments/new",
    );
    expect(screen.getByRole("link", { name: /dashboard.firstWork.join.title/ })).toHaveAttribute(
      "href",
      "/en-US/platform/organizations",
    );
    expect(screen.getByRole("link", { name: /dashboard.firstWork.browse.title/ })).toHaveAttribute(
      "href",
      "/en-US/platform/experiments?visibility=public&focus=search",
    );
  });

  it("fills each card with its translated title and description", () => {
    render(<FirstWorkCards />);

    for (const card of ["create", "join", "browse"]) {
      expect(
        screen.getByRole("heading", { name: `dashboard.firstWork.${card}.title` }),
      ).toBeInTheDocument();
      expect(screen.getByText(`dashboard.firstWork.${card}.description`)).toBeInTheDocument();
    }
  });
});
