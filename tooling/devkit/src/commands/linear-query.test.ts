import { describe, expect, it } from "vitest";

import type { LinearClient } from "../lib/linear.js";
import { parseArgs, runQuery } from "./linear-query.js";

/** Fixtures are untyped while the client contract is generic; this is the one place that gap is bridged. */
function fixtureClient(answer: (document: string) => unknown): LinearClient {
  return {
    query: <T>(document: string): Promise<T> => Promise.resolve(answer(document) as T),
  };
}

describe("parseArgs", () => {
  it("takes an inline document with JSON variables", () => {
    expect(parseArgs(["--query", "{ viewer { id } }", "--variables", '{"a":1}'])).toEqual({
      document: "{ viewer { id } }",
      file: null,
      variables: { a: 1 },
      allowDestructive: false,
    });
  });

  it("takes a file instead, and the destructive flag", () => {
    expect(parseArgs(["--file", "q.graphql", "--allow-destructive"])).toEqual({
      document: null,
      file: "q.graphql",
      variables: {},
      allowDestructive: true,
    });
  });

  it("requires exactly one source and an object for variables", () => {
    expect(() => parseArgs([])).toThrow("exactly one of --query");
    expect(() => parseArgs(["--query", "{ a }", "--file", "f"])).toThrow("exactly one of --query");
    expect(() => parseArgs(["--query", "{ a }", "--variables", "[1]"])).toThrow("JSON object");
    expect(() => parseArgs(["--query"])).toThrow("--query requires a value");
  });
});

describe("runQuery", () => {
  it("prints the result as indented JSON", async () => {
    const lines: string[] = [];

    await runQuery(
      "{ viewer { id } }",
      {},
      fixtureClient(() => ({ viewer: { id: "u1" } })),
      (text) => lines.push(text),
    );

    expect(lines.join("")).toBe('{\n  "viewer": {\n    "id": "u1"\n  }\n}\n');
  });
});
