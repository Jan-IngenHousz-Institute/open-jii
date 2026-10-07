import { describe, expect, it } from "vitest";

import type { LinearClient } from "../lib/linear.js";
import { parseMilestones } from "../lib/milestones.js";
import { parseArgs, writeMilestones } from "./linear-milestones.js";
import type { MilestonesDependencies } from "./linear-milestones.js";

const file = parseMilestones(`# 1. First
Nothing else works without it.

# 2. Second
was: Phase two
It needs the first.
`);

interface Call {
  document: string;
  variables: Record<string, unknown>;
}

interface Node {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
}

/** Fixtures are untyped while the client contract is generic; this is the one place that gap is bridged. */
function fixture(initial: Node[], reorders = true) {
  const calls: Call[] = [];
  const nodes = [...initial];
  const client: LinearClient = {
    query: <T>(document: string, variables: Record<string, unknown> = {}): Promise<T> => {
      calls.push({ document, variables });
      let answer: unknown;
      if (document.includes("projectMilestones(first")) {
        answer = { project: { projectMilestones: { nodes } } };
      } else if (document.includes("projects(first")) {
        answer = {
          projects: { nodes: [{ id: "p1", name: "Notifications", url: "https://l/p1" }] },
        };
      } else if (document.includes("projectMilestoneCreate(")) {
        const input = variables.input as { name: string; description: string; sortOrder: number };
        nodes.push({ id: `new-${nodes.length}`, ...input });
        answer = { projectMilestoneCreate: { success: true } };
      } else if (document.includes("projectMilestoneUpdate(")) {
        const input = variables.input as Partial<Node>;
        const target = nodes.find((node) => node.id === variables.id);
        if (target) Object.assign(target, reorders ? input : { ...input, sortOrder: 0 });
        answer = { projectMilestoneUpdate: { success: true } };
      } else {
        throw new Error(`unexpected document ${document.slice(0, 40)}`);
      }
      return Promise.resolve(answer as T);
    },
  };
  return { client, calls };
}

function deps(client: LinearClient) {
  const lines: string[] = [];
  const value: MilestonesDependencies = { client, write: (text) => lines.push(text) };
  return { value, lines };
}

const mutationNames = (calls: Call[]) =>
  calls.flatMap((call) => /^mutation[^{]*\{\s*(\w+)/.exec(call.document)?.[1] ?? []);

describe("writeMilestones", () => {
  it("prints the plan and writes nothing on a dry run", async () => {
    const { client, calls } = fixture([
      { id: "b", name: "Phase two", description: "Old.", sortOrder: 5 },
      { id: "z", name: "9. Legacy", description: null, sortOrder: 9 },
    ]);
    const d = deps(client);

    await writeMilestones(file, "Notifications", false, d.value);

    expect(mutationNames(calls)).toEqual([]);
    const text = d.lines.join("");
    expect(text).toContain("create  1. First");
    expect(text).toContain('update  2. Second  (renamed from "Phase two", reason, order)');
    expect(text).toContain("left alone, not in the file: 9. Legacy");
    expect(text).toContain("dry run; pass --apply to write");
  });

  it("creates and renames, then reads the order back", async () => {
    const { client, calls } = fixture([
      { id: "b", name: "Phase two", description: "Old.", sortOrder: 5 },
    ]);
    const d = deps(client);

    const isOk = await writeMilestones(file, "Notifications", true, d.value);

    expect(isOk).toBe(true);
    expect(mutationNames(calls)).toEqual(["projectMilestoneCreate", "projectMilestoneUpdate"]);
    expect(calls.find((c) => c.document.includes("projectMilestoneCreate("))?.variables).toEqual({
      input: {
        projectId: "p1",
        name: "1. First",
        description: "Nothing else works without it.",
        sortOrder: 1000,
      },
    });
    expect(d.lines.join("")).toContain("order: read back and matches the file");
  });

  it("reports an order Linear rewrote instead of assuming it", async () => {
    const { client } = fixture(
      [{ id: "b", name: "Phase two", description: "Old.", sortOrder: 5 }],
      false,
    );
    const d = deps(client);

    const isOk = await writeMilestones(file, "Notifications", true, d.value);

    expect(isOk).toBe(false);
    expect(d.lines.join("")).toContain("order: Linear returned the order");
  });

  it("refuses a file that fails the standard before touching Linear", async () => {
    const { client, calls } = fixture([]);
    const broken = parseMilestones("# Unnumbered\nWhy.\n");

    await expect(
      writeMilestones(broken, "Notifications", true, deps(client).value),
    ).rejects.toThrow("fails the standard");
    expect(calls).toEqual([]);
  });
});

describe("parseArgs", () => {
  it("takes the file, an optional project override and the apply flag", () => {
    expect(parseArgs(["m.md", "--project", "Notifications", "--apply"])).toEqual({
      file: "m.md",
      project: "Notifications",
      apply: true,
    });
    expect(parseArgs(["m.md"])).toEqual({ file: "m.md", project: null, apply: false });
    expect(() => parseArgs(["--apply"])).toThrow("Usage");
  });
});
