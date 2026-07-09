import { describe, expect, it } from "vitest";

import { getBreadcrumbTrail } from "./getBreadcrumbTrail";

describe("getBreadcrumbTrail", () => {
  it("returns no trail for the platform root", () => {
    expect(getBreadcrumbTrail("/en/platform", "en")).toEqual([]);
  });

  it("returns no trail for a section root (the page title is shown below)", () => {
    expect(getBreadcrumbTrail("/en/platform/experiments", "en")).toEqual([]);
    expect(getBreadcrumbTrail("/en/platform/workbooks", "en")).toEqual([]);
    expect(getBreadcrumbTrail("/en/platform/macros", "en")).toEqual([]);
    expect(getBreadcrumbTrail("/en/platform/protocols", "en")).toEqual([]);
    expect(getBreadcrumbTrail("/en/platform/account", "en")).toEqual([]);
  });

  it("drops the current page, keeping the parent section for nested non-entity routes", () => {
    expect(getBreadcrumbTrail("/en/platform/experiments/new", "en")).toEqual([
      { segment: "experiments", title: "experiments", href: "/en/platform/experiments" },
    ]);
    expect(getBreadcrumbTrail("/en/platform/macros/new", "en")).toEqual([
      { segment: "macros", title: "macros", href: "/en/platform/macros" },
    ]);
  });

  it("shows only the parent section on entity detail pages (no entity name)", () => {
    expect(getBreadcrumbTrail("/en/platform/experiments/exp-1", "en")).toEqual([
      { segment: "experiments", title: "experiments", href: "/en/platform/experiments" },
    ]);
    expect(getBreadcrumbTrail("/en/platform/workbooks/wb-1", "en")).toEqual([
      { segment: "workbooks", title: "workbooks", href: "/en/platform/workbooks" },
    ]);
  });

  it("stops at the first entity ID for entity sub-tabs and deep routes", () => {
    expect(getBreadcrumbTrail("/en/platform/experiments/exp-1/data", "en")).toEqual([
      { segment: "experiments", title: "experiments", href: "/en/platform/experiments" },
    ]);
    expect(
      getBreadcrumbTrail("/en/platform/experiments/exp-1/analysis/visualizations/viz-1", "en"),
    ).toEqual([{ segment: "experiments", title: "experiments", href: "/en/platform/experiments" }]);
    expect(getBreadcrumbTrail("/en/platform/protocols/proto-1/run", "en")).toEqual([
      { segment: "protocols", title: "protocols", href: "/en/platform/protocols" },
    ]);
  });

  it("handles the experiments-archive section", () => {
    expect(getBreadcrumbTrail("/en/platform/experiments-archive/a-1", "en")).toEqual([
      {
        segment: "experiments-archive",
        title: "experiments-archive",
        href: "/en/platform/experiments-archive",
      },
    ]);
  });

  it("preserves the locale in hrefs", () => {
    expect(getBreadcrumbTrail("/de/platform/experiments/new", "de")[0]?.href).toBe(
      "/de/platform/experiments",
    );
  });
});
