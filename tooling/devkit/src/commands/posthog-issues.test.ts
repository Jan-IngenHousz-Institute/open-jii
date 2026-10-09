import { describe, expect, it, vi } from "vitest";

import type { PostHogClient } from "../lib/posthog.js";
import {
  applyPlan,
  exceptionSamples,
  listIssues,
  parseArgs,
  parseReview,
  planApply,
} from "./posthog-issues.js";
import type { ReviewEntry } from "./posthog-issues.js";

const id = "01a057bc-5c81-7b73-b5e5-dcbeac21303d";

function client(overrides: Partial<PostHogClient> = {}): PostHogClient {
  return {
    query: vi.fn<PostHogClient["query"]>().mockResolvedValue({ columns: [], results: [] }),
    get: vi.fn<PostHogClient["get"]>().mockResolvedValue(null),
    setIssueStatus: vi.fn<PostHogClient["setIssueStatus"]>().mockResolvedValue(undefined),
    ...overrides,
  };
}

function entry(decision: ReviewEntry["decision"], suffix = "0"): ReviewEntry {
  return {
    id: `01a057bc-5c81-7b73-b5e5-dcbeac21303${suffix}`,
    name: "Error",
    description: "Failed to prefetch offline data",
    service: "mobile",
    environment: "unknown",
    appVersion: "2.69.4",
    events: 503,
    users: 121,
    lastSeen: "2026-09-26T17:06:48Z",
    url: "https://eu.posthog.com/project/80726/error_tracking/x",
    decision,
    note: "",
  };
}

describe("parseArgs", () => {
  it("defaults list to 90 days into the gitignored review file", () => {
    expect(parseArgs(["list"])).toEqual({
      command: "list",
      days: 90,
      output: ".claude/posthog/issues-review.json",
    });
  });

  it("refuses a show id that could smuggle HogQL", () => {
    expect(() => parseArgs(["show", "x' OR 1=1 --"])).toThrow("one PostHog issue id");
    expect(parseArgs(["show", id])).toEqual({ command: "show", id });
  });

  it("skips the `--` the root alias passes through", () => {
    expect(parseArgs(["--", "show", id])).toEqual({ command: "show", id });
  });

  it("applies only with --confirm", () => {
    expect(parseArgs(["apply"])).toMatchObject({ command: "apply", confirm: false });
    expect(parseArgs(["apply", "--confirm"])).toMatchObject({ confirm: true });
  });
});

describe("listIssues", () => {
  it("turns query rows into undecided review entries with a link each", async () => {
    const query = vi.fn<PostHogClient["query"]>().mockResolvedValue({
      columns: [
        "id",
        "name",
        "description",
        "service",
        "environment",
        "app_version",
        "events",
        "users",
        "last_seen",
      ],
      results: [[id, "Error", "boom", "mobile", null, "1.1.0", 3, 2, "2026-09-26"]],
    });

    const [first] = await listIssues(client({ query }), 30);

    expect(query.mock.calls[0]?.[0]).toContain("INTERVAL 30 DAY");
    expect(first).toMatchObject({
      id,
      service: "mobile",
      environment: "unknown",
      appVersion: "1.1.0",
      events: 3,
      decision: "",
      url: `https://eu.posthog.com/project/80726/error_tracking/${id}`,
    });
  });

  it("leaves lastSeen empty for an issue with no events in the window", async () => {
    const query = vi.fn<PostHogClient["query"]>().mockResolvedValue({
      columns: ["id", "events", "last_seen"],
      results: [[id, 0, "1970-01-01T00:00:00Z"]],
    });

    const [first] = await listIssues(client({ query }), 30);

    expect(first).toMatchObject({ events: 0, lastSeen: null });
  });
});

describe("parseReview", () => {
  it("rejects an unknown decision rather than guessing", () => {
    const file = JSON.stringify([{ ...entry("keep"), decision: "close" }]);

    expect(() => parseReview(file)).toThrow("has decision close");
  });
});

describe("planApply and applyPlan", () => {
  it("dry-runs by default and lists tickets without filing anything", async () => {
    const setIssueStatus = vi.fn<PostHogClient["setIssueStatus"]>();
    const lines: string[] = [];
    const plan = planApply([
      entry("resolve", "1"),
      entry("suppress", "2"),
      entry("ticket", "3"),
      entry("", "4"),
    ]);

    await applyPlan(plan, client({ setIssueStatus }), false, (line) => lines.push(line));

    expect(setIssueStatus).not.toHaveBeenCalled();
    expect(lines.join("")).toContain("would set 01a057bc-5c81-7b73-b5e5-dcbeac213031");
    expect(lines.join("")).toContain(
      "2 status change(s) planned; pass --confirm to apply, 1 to ticket, 1 undecided",
    );
  });

  it("sets resolved and suppressed statuses when confirmed", async () => {
    const setIssueStatus = vi.fn<PostHogClient["setIssueStatus"]>().mockResolvedValue(undefined);

    await applyPlan(
      planApply([entry("resolve", "1"), entry("suppress", "2")]),
      client({ setIssueStatus }),
      true,
      () => {
        // output checked in the dry run
      },
    );

    expect(setIssueStatus.mock.calls).toEqual([
      ["01a057bc-5c81-7b73-b5e5-dcbeac213031", "resolved"],
      ["01a057bc-5c81-7b73-b5e5-dcbeac213032", "suppressed"],
    ]);
  });
});

describe("exceptionSamples", () => {
  it("keeps type, value and the top frames, innermost first", () => {
    const raw = JSON.stringify([
      {
        type: "TypeError",
        value: "Cannot read property 'kind' of undefined",
        stacktrace: {
          frames: [
            { function: "outer", filename: "app.js", lineno: 1 },
            { function: "inner", source: "screen.tsx", line: 42 },
          ],
        },
      },
    ]);

    expect(exceptionSamples(raw)).toEqual([
      {
        type: "TypeError",
        value: "Cannot read property 'kind' of undefined",
        frames: [
          { function: "inner", location: "screen.tsx:42" },
          { function: "outer", location: "app.js:1" },
        ],
      },
    ]);
  });

  it("drops a development bundle's query string from the frame location", () => {
    const raw = [
      {
        type: "Error",
        value: "x",
        stacktrace: {
          frames: [
            {
              filename: "http://10.0.0.2:8081/index.bundle//&platform=android&dev=true",
              lineno: 1,
            },
          ],
        },
      },
    ];

    expect(exceptionSamples(raw)[0]?.frames).toEqual([
      { function: "?", location: "http://10.0.0.2:8081/index.bundle//:1" },
    ]);
  });

  it("reads nothing from a value that is not an exception list", () => {
    expect(exceptionSamples("null")).toEqual([]);
    expect(exceptionSamples(undefined)).toEqual([]);
  });
});
