import { describe, expect, it, vi } from "vitest";

import type { PostHogClient } from "../lib/posthog.js";
import { parseArgs, runQuery } from "./posthog-query.js";

describe("parseArgs", () => {
  it("takes exactly one of an inline query or a .sql file", () => {
    expect(parseArgs(["--query", "SELECT 1"])).toEqual({
      query: "SELECT 1",
      file: null,
      output: null,
    });
    expect(parseArgs(["--file", "q.sql", "--output", "out.json"])).toEqual({
      query: null,
      file: "q.sql",
      output: "out.json",
    });
    expect(() => parseArgs([])).toThrow("exactly one");
    expect(() => parseArgs(["--query", "SELECT 1", "--file", "q.sql"])).toThrow("exactly one");
    expect(() => parseArgs(["--file", "q.graphql"])).toThrow(".sql");
  });
});

describe("runQuery", () => {
  it("prints the columns and rows as JSON", async () => {
    const query = vi
      .fn<PostHogClient["query"]>()
      .mockResolvedValue({ columns: ["ok"], results: [[1]] });
    const client: PostHogClient = { query, get: vi.fn(), setIssueStatus: vi.fn() };
    let printed = "";

    await runQuery("SELECT 1 AS ok", client, (text) => {
      printed += text;
    });

    expect(JSON.parse(printed)).toEqual({ columns: ["ok"], results: [[1]] });
  });
});
