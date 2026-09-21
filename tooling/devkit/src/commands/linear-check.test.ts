import { describe, expect, it } from "vitest";

import { parseDraft } from "../lib/ticket-draft.js";
import { checkDraft, formatReports, parseArgs } from "./linear-check.js";

const good = `# Researcher can sort any resource list

labels: Feature, Fullstack

## User story

**WHO:** A researcher.

**WHAT:** They sort.

**WHY:** Nothing sorts.

## Acceptance criteria

- Sorting works.

## Dependencies and risks

None.

## Additional context

None.

## How it was built

## Testing criteria
`;

const bad = `# DISCOVERY: a very long title that keeps going well past the seventy character limit

## User story

**WHO:** A researcher.

## Acceptance criteria

## Dependencies and risks

## Additional context

## How it was built

## Testing criteria
`;

describe("checkDraft and formatReports", () => {
  it("prints one line per ticket, findings indented, and a count", () => {
    const { text, ok } = formatReports(checkDraft(parseDraft(`${good}\n${bad}`)));

    expect(ok).toBe(false);
    expect(text).toBe(
      [
        "ok    1. Researcher can sort any resource list  [work-item 190/1200, bullet max 2]",
        "FAIL  2. DISCOVERY: a very long title that keeps going well past the seventy character limit  [work-item 117/1200, bullet max 0]",
        "        title: 83 characters; the limit is 70",
        "        title: starts with a type prefix; that is a label",
        "        persona: User story has no **WHAT:** line",
        "        persona: User story has no **WHY:** line",
        "        gate: Acceptance criteria is empty",
        "2 ticket(s) checked, 1 failing",
        "",
      ].join("\n"),
    );
  });

  it("is ok when every ticket passes", () => {
    expect(formatReports(checkDraft(parseDraft(good))).ok).toBe(true);
  });
});

describe("parseArgs", () => {
  it("takes the draft path and nothing else", () => {
    expect(parseArgs(["drafts/home.md"])).toEqual({ file: "drafts/home.md" });
    expect(() => parseArgs([])).toThrow("Usage");
  });
});
