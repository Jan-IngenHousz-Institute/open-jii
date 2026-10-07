import { describe, expect, it } from "vitest";

import { checkMilestones, parseMilestones, planMilestones, sortOrderAt } from "./milestones.js";
import type { DesiredMilestone } from "./milestones.js";
import type { ProjectMilestone } from "./projects.js";

const file = `---
project: "Notifications"
---

# 1. Members see what happened to their work
Nothing else can be tested without the feed, so it comes first.

# 2. Members choose what reaches them
was: Phase two
Preferences need the feed to exist, so they follow it.
`;

const desired = (name: string, description = "A reason.", was: string | null = null) => ({
  name,
  was,
  description,
});

const live = (
  id: string,
  name: string,
  sortOrder: number,
  description = "A reason.",
): ProjectMilestone => ({
  id,
  name,
  description,
  sortOrder,
});

describe("parseMilestones", () => {
  it("reads the project, each heading as a milestone, the was line and the reason", () => {
    expect(parseMilestones(file)).toEqual({
      project: "Notifications",
      milestones: [
        {
          name: "1. Members see what happened to their work",
          was: null,
          description: "Nothing else can be tested without the feed, so it comes first.",
        },
        {
          name: "2. Members choose what reaches them",
          was: "Phase two",
          description: "Preferences need the feed to exist, so they follow it.",
        },
      ],
    });
  });

  it("refuses an empty file and text before the first heading", () => {
    expect(() => parseMilestones("")).toThrow("at least one milestone");
    expect(() => parseMilestones("intro\n\n# 1. A\nWhy.\n")).toThrow("before the first");
  });
});

describe("checkMilestones", () => {
  it("passes a numbered, reasoned, strictly ordered file", () => {
    expect(checkMilestones(parseMilestones(file))).toEqual([]);
  });

  it("fails names that are not their position, missing and long reasons, and dashes", () => {
    const findings = checkMilestones({
      project: null,
      milestones: [
        desired("Foundations", "Because it is first."),
        desired("3. Skipped", ""),
        desired("3. Skipped", "First reason. Second reason."),
        desired("4. Dash", "A reason with a dash \u2014 here."),
      ],
    });

    expect(findings.map((finding) => `${finding.rule}`)).toEqual([
      "name",
      "name",
      "reason",
      "reason",
      "name",
      "dash",
    ]);
  });
});

describe("planMilestones", () => {
  it("spreads positions by a thousand so Linear keeps them", () => {
    expect(sortOrderAt(1)).toBe(1000);
    expect(sortOrderAt(3)).toBe(3000);
  });

  it("creates what is missing, keeps what matches, and renames through was without a second copy", () => {
    const plan = planMilestones(
      [
        desired("1. One", "Reason one."),
        desired("2. Two", "Reason two.", "Phase two"),
        desired("3. Three", "Reason three."),
      ],
      [live("a", "1. One", 1000, "Reason one."), live("b", "Phase two", 2000, "Old reason.")],
    );

    expect(plan.actions).toEqual([
      { kind: "keep", name: "1. One" },
      {
        kind: "update",
        id: "b",
        name: "2. Two",
        description: "Reason two.",
        sortOrder: 2000,
        changes: ['renamed from "Phase two"', "reason"],
      },
      { kind: "create", name: "3. Three", description: "Reason three.", sortOrder: 3000 },
    ]);
    expect(plan.leftAlone).toEqual([]);
  });

  it("reorders by position and leaves milestones the file does not mention alone", () => {
    const plan = planMilestones(
      [desired("1. One", "R."), desired("2. Two", "R.")],
      [live("b", "2. Two", 1, "R."), live("a", "1. One", 2, "R."), live("z", "9. Old", 3, "R.")],
    );

    expect(plan.actions.map((action) => action.kind)).toEqual(["update", "update"]);
    expect(plan.actions[0]).toMatchObject({ id: "a", sortOrder: 1000, changes: ["order"] });
    expect(plan.leftAlone.map((milestone) => milestone.id)).toEqual(["z"]);
  });

  it("matches an existing milestone only once", () => {
    const wanted: DesiredMilestone[] = [
      desired("1. One"),
      desired("2. Two", "A reason.", "1. One"),
    ];

    const plan = planMilestones(wanted, [live("a", "1. One", 1000)]);

    expect(plan.actions.map((action) => action.kind)).toEqual(["keep", "create"]);
  });
});
