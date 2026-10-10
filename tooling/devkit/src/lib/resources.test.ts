import { describe, expect, it } from "vitest";

import { parseResources, planResources } from "./resources.js";
import type { ProjectResource } from "./resources.js";

const file = `---
project: Notifications
---

- [Notifications: project plan](https://uploads.linear.app/a/plan)
* [Email sending quotas](https://docs.aws.amazon.com/ses/latest/dg/quotas.html)
`;

const live = (id: string, label: string, url: string, sortOrder: number): ProjectResource => ({
  id,
  label,
  url,
  sortOrder,
});

describe("parseResources", () => {
  it("reads the project and one markdown link per bullet", () => {
    expect(parseResources(file)).toEqual({
      project: "Notifications",
      resources: [
        { label: "Notifications: project plan", url: "https://uploads.linear.app/a/plan" },
        {
          label: "Email sending quotas",
          url: "https://docs.aws.amazon.com/ses/latest/dg/quotas.html",
        },
      ],
    });
  });

  it("refuses prose, an empty list and a URL listed twice", () => {
    expect(() => parseResources("Some notes\n")).toThrow('Each line is "- [label](https url)"');
    expect(() => parseResources("---\nproject: X\n---\n")).toThrow("at least one link");
    expect(() => parseResources("- [A](https://a.example)\n- [B](https://a.example)\n")).toThrow(
      "https://a.example is listed twice",
    );
  });
});

describe("planResources", () => {
  it("matches by URL, so a relabel updates, and leaves links the file does not name alone", () => {
    const plan = planResources(parseResources(file).resources, [
      live("r1", "Plan", "https://uploads.linear.app/a/plan", 1000),
      live("r9", "Old sketch", "https://uploads.linear.app/a/old", 3000),
    ]);

    expect(plan.actions).toEqual([
      {
        kind: "update",
        id: "r1",
        label: "Notifications: project plan",
        sortOrder: 1000,
        changes: ['relabelled from "Plan"'],
      },
      {
        kind: "create",
        label: "Email sending quotas",
        url: "https://docs.aws.amazon.com/ses/latest/dg/quotas.html",
        sortOrder: 2000,
      },
    ]);
    expect(plan.leftAlone.map((resource) => resource.id)).toEqual(["r9"]);
  });

  it("keeps links Linear renumbered when their order is still right", () => {
    const plan = planResources(
      [
        { label: "A", url: "https://a.example" },
        { label: "B", url: "https://b.example" },
      ],
      [live("r1", "A", "https://a.example", 7), live("r2", "B", "https://b.example", 9)],
    );

    expect(plan.actions.map((action) => action.kind)).toEqual(["keep", "keep"]);
  });

  it("keeps a link that already matches", () => {
    const plan = planResources(
      [{ label: "A", url: "https://a.example" }],
      [live("r1", "A", "https://a.example", 1000)],
    );

    expect(plan.actions).toEqual([{ kind: "keep", label: "A" }]);
  });
});
