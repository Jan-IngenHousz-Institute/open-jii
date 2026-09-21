import { describe, expect, it } from "vitest";

import type { LinearClient } from "../lib/linear.js";
import { checkDocument, parseArgs, publishDocument } from "./linear-document.js";

interface RecordedCall {
  document: string;
  variables: Record<string, unknown>;
}

/** Fixtures are untyped while the client contract is generic; this is the one place that gap is bridged. */
function fixtureClient(
  answer: (document: string, variables: Record<string, unknown>) => unknown,
): LinearClient {
  return {
    query: <T>(document: string, variables: Record<string, unknown> = {}): Promise<T> =>
      Promise.resolve(answer(document, variables) as T),
  };
}

function projectClient(existingTitle: string | null) {
  const calls: RecordedCall[] = [];
  const client = fixtureClient((document, variables) => {
    calls.push({ document, variables });
    if (document.includes("projects(")) {
      return { projects: { nodes: [{ id: "p1", name: "Explore your data" }] } };
    }
    if (document.includes("documents(")) {
      const nodes =
        existingTitle === null ? [] : [{ id: "d1", title: existingTitle, url: "https://l/d1" }];
      return { project: { documents: { nodes } } };
    }
    if (document.includes("documentCreate")) {
      return { documentCreate: { success: true, document: { url: "https://l/new" } } };
    }
    if (document.includes("documentUpdate")) {
      return { documentUpdate: { success: true, document: { url: "https://l/d1" } } };
    }
    throw new Error(`unexpected query ${document}`);
  });
  return { client, calls };
}

const args = {
  file: "deep-dive.md",
  project: "Explore your data",
  title: "Explore your data: deep dive",
};
const good = "Written against main.\n\n```mermaid\nflowchart LR\n  A --> B\n```\n";

describe("parseArgs", () => {
  it("takes the file, the project, the title and the apply flag", () => {
    expect(
      parseArgs(["--project", "Explore your data", "d.md", "--title", "X: deep dive", "--apply"]),
    ).toEqual({ file: "d.md", project: "Explore your data", title: "X: deep dive", apply: true });
  });

  it("requires all three", () => {
    expect(() => parseArgs(["d.md", "--project", "X"])).toThrow("Usage: linear-document");
    expect(() => parseArgs(["--project", "X", "--title", "T"])).toThrow("Usage: linear-document");
    expect(() => parseArgs(["d.md", "--project", "--title", "T"])).toThrow("--project requires");
  });
});

describe("checkDocument", () => {
  it("flags dashes and a broken diagram, and passes clean prose with a valid one", async () => {
    await expect(checkDocument(good)).resolves.toEqual([]);

    const findings = await checkDocument(
      'A body — with a dash.\n\n```mermaid\nflowchart LR\n  A["x] --> B\n```\n',
    );
    expect(findings.map((f) => f.rule)).toEqual(["dash", "mermaid"]);
  });
});

describe("publishDocument", () => {
  it("refuses a failing document before touching Linear", async () => {
    const { client, calls } = projectClient(null);
    const lines: string[] = [];

    await expect(
      publishDocument(
        "Bad — dash.",
        { ...args, apply: true },
        { client, write: (t) => lines.push(t) },
      ),
    ).rejects.toThrow("fails the checks");
    expect(calls).toEqual([]);
    expect(lines.join("")).toContain("dash:");
  });

  it("dry-runs by saying whether it would create or update, and writes nothing", async () => {
    const { client, calls } = projectClient("explore your data: deep dive");
    const lines: string[] = [];

    const url = await publishDocument(
      good,
      { ...args, apply: false },
      { client, write: (t) => lines.push(t) },
    );

    expect(url).toBeNull();
    expect(lines.join("")).toContain(
      `update https://l/d1; ${good.length} characters, 1 diagram(s)`,
    );
    expect(lines.join("")).toContain("dry run");
    expect(calls.map((c) => c.document.includes("mutation"))).toEqual([false, false]);
  });

  it("creates when no document carries the title, and updates in place when one does", async () => {
    const fresh = projectClient(null);
    await expect(
      publishDocument(
        good,
        { ...args, apply: true },
        { client: fresh.client, write: () => undefined },
      ),
    ).resolves.toBe("https://l/new");
    const create = fresh.calls.find((c) => c.document.includes("documentCreate"));
    expect(create?.variables).toEqual({
      input: { projectId: "p1", title: args.title, content: good },
    });

    const existing = projectClient(args.title);
    await expect(
      publishDocument(
        good,
        { ...args, apply: true },
        { client: existing.client, write: () => undefined },
      ),
    ).resolves.toBe("https://l/d1");
    const update = existing.calls.find((c) => c.document.includes("documentUpdate"));
    expect(update?.variables).toEqual({ id: "d1", input: { content: good } });
  });
});
