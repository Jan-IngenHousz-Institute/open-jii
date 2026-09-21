import { describe, expect, it } from "vitest";

import type { LinearClient } from "./linear.js";
import { findProject, listProjectDocuments } from "./projects.js";

/** Fixtures are untyped while the client contract is generic; this is the one place that gap is bridged. */
function fixtureClient(answer: (document: string) => unknown): LinearClient {
  return {
    query: <T>(document: string): Promise<T> => Promise.resolve(answer(document) as T),
  };
}

describe("findProject", () => {
  it("takes the one exact match among close ones, ignoring case and padding", async () => {
    const client = fixtureClient(() => ({
      projects: {
        nodes: [
          { id: "p1", name: "Platform home and research discovery" },
          { id: "p2", name: "Platform home" },
        ],
      },
    }));

    await expect(findProject(client, " platform home ")).resolves.toEqual({
      id: "p2",
      name: "Platform home",
    });
  });

  it("refuses zero or several exact matches and names the close ones", async () => {
    const client = fixtureClient(() => ({ projects: { nodes: [{ id: "p1", name: "Home" }] } }));

    await expect(findProject(client, "Platform home")).rejects.toThrow(
      'found 0; close matches: "Home"',
    );
  });
});

describe("listProjectDocuments", () => {
  it("returns the project's documents with their urls", async () => {
    const client = fixtureClient(() => ({
      project: { documents: { nodes: [{ id: "d1", title: "X: deep dive", url: "https://l/d1" }] } },
    }));

    await expect(listProjectDocuments(client, "p1")).resolves.toEqual([
      { id: "d1", title: "X: deep dive", url: "https://l/d1" },
    ]);
  });
});
