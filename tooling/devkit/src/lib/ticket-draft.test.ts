import { describe, expect, it } from "vitest";

import { parseDraft, substituteReferences } from "./ticket-draft.js";

const draft = `---
project: Platform home and research discovery
state: Backlog
---

# Researcher can sort any resource list

labels: Feature, Fullstack
blocks: 2

## User story

**WHO:** A researcher.

## Acceptance criteria

- Sorting works; {{2}} adds filters.

<!-- comment -->
Suggested implementation. See {{2}} for the toolbar.

# Researcher can filter any resource list

labels: Feature, Fullstack

## User story

**WHO:** A researcher.
`;

describe("parseDraft", () => {
  it("reads the front matter, one ticket per # title, and the comment after the marker", () => {
    const parsed = parseDraft(draft);

    expect(parsed).toMatchObject({
      project: "Platform home and research discovery",
      team: "OJD",
      state: "Backlog",
    });
    expect(parsed.tickets).toHaveLength(2);
    expect(parsed.tickets[0]).toMatchObject({
      index: 1,
      title: "Researcher can sort any resource list",
      labels: ["Feature", "Fullstack"],
      blocks: [2],
      comment: "Suggested implementation. See {{2}} for the toolbar.",
    });
    expect(parsed.tickets[0]?.body).toBe(
      "## User story\n\n**WHO:** A researcher.\n\n## Acceptance criteria\n\n- Sorting works; {{2}} adds filters.",
    );
    expect(parsed.tickets[1]).toMatchObject({ index: 2, blocks: [], comment: null });
  });

  it("defaults the team and state when there is no front matter", () => {
    expect(parseDraft("# T\n\n## User story\n\nx\n")).toMatchObject({
      project: null,
      team: "OJD",
      state: "Backlog",
    });
  });

  it("refuses text before the first title, stray lines under a title, and empty tickets", () => {
    expect(() => parseDraft("intro\n\n# T\n\n## A\n")).toThrow("before the first");
    expect(() => parseDraft("# T\n\nnote\n\n## A\n")).toThrow('only "labels:" and "blocks:"');
    expect(() => parseDraft("# T\n\nlabels: A\n")).toThrow('no "## " section');
    expect(() => parseDraft("")).toThrow("at least one ticket");
  });

  it("refuses references and blocks that point nowhere or at the ticket itself", () => {
    expect(() => parseDraft("# T\n\nblocks: 1\n\n## A\n\nx\n")).toThrow("refers to itself");
    expect(() => parseDraft("# T\n\n## A\n\nsee {{3}}\n")).toThrow("there are 1");
    expect(() => parseDraft("# T\n\nblocks: two\n\n## A\n\nx\n")).toThrow("ticket numbers");
  });
});

describe("substituteReferences", () => {
  it("swaps known numbers and leaves unknown ones for a later pass", () => {
    const ids = new Map([[2, "OJD-1859"]]);

    expect(substituteReferences("Needs {{2}} and {{5}}.", ids)).toBe("Needs OJD-1859 and {{5}}.");
  });
});
