import { describe, expect, it } from "vitest";

import type { LinearClient } from "../lib/linear.js";
import { filtersProject, parseArgs, scaffoldView, viewUrl } from "./linear-view.js";

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

// `views` is what the workspace already holds, so each test decides whether one of them filters p1.
function workspace(views: unknown[], projectName = "Explore your data") {
  const calls: RecordedCall[] = [];
  const client = fixtureClient((document, variables) => {
    calls.push({ document, variables });
    if (document.includes("projects(")) {
      return { projects: { nodes: [{ id: "p1", name: projectName, url: "https://l/project" }] } };
    }
    if (document.includes("organization")) return { organization: { urlKey: "openjii" } };
    if (document.includes("customViews(")) return { customViews: { nodes: views } };
    if (document.includes("customViewCreate")) {
      return { customViewCreate: { success: true, customView: { id: "v2", slugId: "def456" } } };
    }
    if (document.includes("documents(")) return { project: { documents: { nodes: [] } } };
    if (document.includes("documentCreate")) {
      return { documentCreate: { success: true, document: { url: "https://l/doc" } } };
    }
    throw new Error(`unexpected query ${document}`);
  });
  return { client, calls };
}

const unrelated = { id: "v9", name: "Standup view", slugId: "zzz999", filterData: { and: [] } };

describe("parseArgs, viewUrl and filtersProject", () => {
  it("takes the project name, an optional label and the apply flag", () => {
    expect(parseArgs(["--project", "Explore your data", "--apply"])).toEqual({
      project: "Explore your data",
      label: null,
      apply: true,
    });
    expect(parseArgs(["--project", "A: long name", "--label", "A"]).label).toBe("A");
    expect(() => parseArgs([])).toThrow("Usage: linear-view");
    expect(() => parseArgs(["--project", "--apply"])).toThrow("--project requires a value");
  });

  it("builds the address the way Linear does, from the name and the slug id", () => {
    expect(viewUrl("openjii", "Explore your data: dashboard & vis", "2ef36c3db348")).toBe(
      "https://linear.app/openjii/view/explore-your-data-dashboard-vis-2ef36c3db348",
    );
  });

  it("sees a project filter written as eq, as in, or nested, and no filter at all", () => {
    expect(filtersProject({ project: { id: { eq: "p1" } } }, "p1")).toBe(true);
    expect(filtersProject({ and: [{ project: { id: { in: ["p1"] } } }] }, "p1")).toBe(true);
    expect(filtersProject({ and: [{ project: { id: { in: ["p2"] } } }] }, "p1")).toBe(false);
    expect(filtersProject(null, "p1")).toBe(false);
  });
});

describe("scaffoldView", () => {
  it("dry-runs: names the view to create and the document, and writes nothing", async () => {
    const { client, calls } = workspace([unrelated]);
    const lines: string[] = [];

    await scaffoldView(
      { project: "Explore your data", label: null, apply: false },
      { client, write: (t) => lines.push(t) },
    );

    const text = lines.join("");
    expect(text).toContain('view "Explore your data": create, shared, filtered to the project');
    expect(text).toContain(
      '"Explore your data: live ticket view" on project "Explore your data": create',
    );
    expect(calls.some((c) => c.document.includes("mutation"))).toBe(false);
  });

  it("creates a workspace view, never a project-scoped one, and links the project's own URL", async () => {
    const { client, calls } = workspace([unrelated]);
    const lines: string[] = [];

    await scaffoldView(
      { project: "Explore your data", label: null, apply: true },
      { client, write: (t) => lines.push(t) },
    );

    const create = calls.find((c) => c.document.includes("customViewCreate"));
    expect(create?.variables).toEqual({
      input: {
        name: "Explore your data",
        description: "Every issue in the Explore your data project, with status and assignee.",
        shared: true,
        filterData: { project: { id: { eq: "p1" } } },
      },
    });
    expect(JSON.stringify(create?.variables)).not.toContain("projectId");

    const published = JSON.stringify(
      calls.find((c) => c.document.includes("documentCreate"))?.variables,
    );
    expect(published).toContain("https://linear.app/openjii/view/explore-your-data-def456");
    expect(published).toContain("https://l/project");
    expect(lines.join("")).toContain(
      "created https://linear.app/openjii/view/explore-your-data-def456",
    );
  });

  it("reuses a view that filters the project, whatever the team called it", async () => {
    const theirs = {
      id: "v1",
      name: "Platform home and research discovery",
      slugId: "b69c592cb057",
      filterData: { and: [{ project: { id: { in: ["p1"] } } }] },
    };
    const { client, calls } = workspace(
      [unrelated, theirs],
      "Platform home and research discovery",
    );
    const lines: string[] = [];

    await scaffoldView(
      { project: "Platform home and research discovery", label: "Platform home", apply: true },
      { client, write: (t) => lines.push(t) },
    );

    expect(calls.some((c) => c.document.includes("customViewCreate"))).toBe(false);
    expect(lines.join("")).toContain(
      'view "Platform home and research discovery" already filters this project',
    );
    const published = calls.find((c) => c.document.includes("documentCreate"))?.variables;
    expect(published).toMatchObject({ input: { title: "Platform home: live ticket view" } });
    expect(JSON.stringify(published)).toContain(
      "platform-home-and-research-discovery-b69c592cb057",
    );
  });

  it("names a new view and its document by the project's short label", async () => {
    const { client, calls } = workspace(
      [],
      "Explore your data: dashboard & visualization extensions",
    );

    await scaffoldView(
      {
        project: "Explore your data: dashboard & visualization extensions",
        label: null,
        apply: true,
      },
      { client, write: () => undefined },
    );

    expect(calls.find((c) => c.document.includes("customViewCreate"))?.variables).toMatchObject({
      input: { name: "Explore your data" },
    });
    expect(calls.find((c) => c.document.includes("documentCreate"))?.variables).toMatchObject({
      input: { title: "Explore your data: live ticket view" },
    });
  });
});
