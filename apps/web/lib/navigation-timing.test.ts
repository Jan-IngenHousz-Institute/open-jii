import { describe, expect, it } from "vitest";

import { navigationTiming, routeShape } from "./navigation-timing";

describe("navigationTiming", () => {
  it("hands the navigation to the page it landed on, once", () => {
    navigationTiming.start("/en-US/platform/workbooks?view=mine", "push");

    expect(navigationTiming.take("/en-US/platform/workbooks")).toMatchObject({ type: "push" });
    expect(navigationTiming.take("/en-US/platform/workbooks")).toBeNull();
  });

  it("drops a navigation that landed somewhere else", () => {
    navigationTiming.start("/en-US/platform/workbooks", "push");

    expect(navigationTiming.take("/en-US/login")).toBeNull();
  });
});

describe("routeShape", () => {
  it("takes record ids out of the path", () => {
    expect(
      routeShape("/en-US/platform/experiments/3e5309b8-d5f2-4f7a-b20a-8b5e1e73a9f1/data"),
    ).toBe("/en-US/platform/experiments/:id/data");
  });
});
