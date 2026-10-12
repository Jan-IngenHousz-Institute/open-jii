import { describe, expect, it } from "vitest";

import type { LinearClient } from "../lib/linear.js";
import { parseResources } from "../lib/resources.js";
import { parseArgs, writeResources } from "./linear-resources.js";

interface Call {
  document: string;
  variables: Record<string, unknown>;
}

/** Fixtures are untyped while the client contract is generic; this is the one place that gap is bridged. */
function fixture(): { client: LinearClient; calls: Call[] } {
  const calls: Call[] = [];
  const client: LinearClient = {
    query: <T>(document: string, variables: Record<string, unknown> = {}): Promise<T> => {
      calls.push({ document, variables });
      let answer: unknown;
      if (document.includes("externalLinks(")) {
        answer = {
          project: {
            externalLinks: {
              nodes: [{ id: "r1", label: "Plan", url: "https://a.example/plan", sortOrder: 1000 }],
            },
          },
        };
      } else if (document.includes("projects(first")) {
        answer = {
          projects: { nodes: [{ id: "p1", name: "Notifications", url: "https://l/p1" }] },
        };
      } else if (document.includes("entityExternalLinkCreate(")) {
        answer = { entityExternalLinkCreate: { success: true } };
      } else if (document.includes("entityExternalLinkUpdate(")) {
        answer = { entityExternalLinkUpdate: { success: true } };
      } else {
        throw new Error(`unexpected document ${document.slice(0, 40)}`);
      }
      return Promise.resolve(answer as T);
    },
  };
  return { client, calls };
}

const file = parseResources(
  "- [Notifications: project plan](https://a.example/plan)\n- [Quotas](https://a.example/quotas)\n",
);

const mutationNames = (calls: Call[]) =>
  calls.flatMap((call) => /^mutation[^{]*\{\s*(\w+)/.exec(call.document)?.[1] ?? []);

describe("writeResources", () => {
  it("prints the plan and writes nothing on a dry run", async () => {
    const { client, calls } = fixture();
    const lines: string[] = [];

    await writeResources(file, "Notifications", false, { client, write: (t) => lines.push(t) });

    expect(mutationNames(calls)).toEqual([]);
    expect(lines.join("")).toContain(
      'update  Notifications: project plan  (relabelled from "Plan")',
    );
    expect(lines.join("")).toContain("create  Quotas  https://a.example/quotas");
    expect(lines.join("")).toContain("dry run; pass --apply to write");
  });

  it("adds the missing link to the project and relabels the existing one", async () => {
    const { client, calls } = fixture();

    await writeResources(file, "Notifications", true, { client, write: () => undefined });

    expect(mutationNames(calls)).toEqual(["entityExternalLinkUpdate", "entityExternalLinkCreate"]);
    expect(calls.find((c) => c.document.includes("entityExternalLinkCreate("))?.variables).toEqual({
      input: { projectId: "p1", label: "Quotas", url: "https://a.example/quotas", sortOrder: 2000 },
    });
  });
});

describe("parseArgs", () => {
  it("takes the file, an optional project and the apply flag", () => {
    expect(parseArgs(["r.md", "--project", "Notifications", "--apply"])).toEqual({
      file: "r.md",
      project: "Notifications",
      apply: true,
    });
    expect(() => parseArgs([])).toThrow("Usage");
  });
});
