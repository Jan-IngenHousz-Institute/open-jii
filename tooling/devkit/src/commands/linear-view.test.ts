import { describe, expect, it } from "vitest";

import type { LinearClient } from "../lib/linear.js";
import { parseArgs, scaffoldView, viewUrl } from "./linear-view.js";

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

function workspace(existingView: boolean, projectName = "Explore your data") {
  const calls: RecordedCall[] = [];
  const client = fixtureClient((document, variables) => {
    calls.push({ document, variables });
    if (document.includes("projects(")) {
      return {
        projects: { nodes: [{ id: "p1", name: projectName, url: "https://l/project" }] },
      };
    }
    if (document.includes("organization")) return { organization: { urlKey: "openjii" } };
    if (document.includes("customViews(")) {
      const asked = String(variables.name);
      const nodes =
        existingView && asked.length > 0 ? [{ id: "v1", name: asked, slugId: "abc123" }] : [];
      return { customViews: { nodes } };
    }
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

describe("parseArgs and viewUrl", () => {
  it("takes the project name and the apply flag", () => {
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
});

describe("scaffoldView", () => {
  it("dry-runs: names the view to create and the document, and writes nothing", async () => {
    const { client, calls } = workspace(false);
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

  it("creates the view and its document on apply", async () => {
    const { client, calls } = workspace(false);
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
    const document = calls.find((c) => c.document.includes("documentCreate"));
    expect(String(document?.variables.input)).not.toBe("");
    expect(JSON.stringify(document?.variables)).toContain(
      "https://linear.app/openjii/view/explore-your-data-def456",
    );
    expect(lines.join("")).toContain(
      "created https://linear.app/openjii/view/explore-your-data-def456",
    );
  });

  it("names the view and the document by the project's short label, not its full name", async () => {
    const { client, calls } = workspace(
      false,
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

    const create = calls.find((c) => c.document.includes("customViewCreate"))?.variables;
    expect(create).toMatchObject({ input: { name: "Explore your data" } });
    const published = calls.find((c) => c.document.includes("documentCreate"))?.variables;
    expect(published).toMatchObject({
      input: { title: "Explore your data: live ticket view" },
    });
    expect(JSON.stringify(published)).toContain("https://l/project");
  });

  it("takes an explicit label over the derived one", async () => {
    const { client, calls } = workspace(false, "Platform home and research discovery");

    await scaffoldView(
      { project: "Platform home and research discovery", label: "Platform home", apply: true },
      { client, write: () => undefined },
    );

    expect(calls.find((c) => c.document.includes("customViewCreate"))?.variables).toMatchObject({
      input: { name: "Platform home" },
    });
    expect(calls.find((c) => c.document.includes("documentCreate"))?.variables).toMatchObject({
      input: { title: "Platform home: live ticket view" },
    });
  });

  it("looks the view up by name rather than listing the workspace, and never sets projectId", async () => {
    const { client, calls } = workspace(false);

    await scaffoldView(
      { project: "Explore your data", label: null, apply: true },
      { client, write: () => undefined },
    );

    const lookup = calls.find((c) => c.document.includes("customViews("));
    expect(lookup?.variables).toEqual({ name: "Explore your data" });
    const create = calls.find((c) => c.document.includes("customViewCreate"));
    expect(JSON.stringify(create?.variables)).not.toContain("projectId");
  });

  it("reuses a view that already carries the project's label", async () => {
    const { client, calls } = workspace(true);

    await scaffoldView(
      { project: "Explore your data", label: null, apply: true },
      { client, write: () => undefined },
    );

    expect(calls.some((c) => c.document.includes("customViewCreate"))).toBe(false);
    expect(
      JSON.stringify(calls.find((c) => c.document.includes("documentCreate"))?.variables),
    ).toContain("explore-your-data-abc123");
  });
});
