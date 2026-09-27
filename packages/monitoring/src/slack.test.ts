import { describe, expect, it } from "vitest";

import type { SlackBlock } from "./slack.js";
import {
  actions,
  context,
  divider,
  header,
  image,
  section,
  table,
  tableSections,
} from "./slack.js";

describe("blocks", () => {
  it("truncates a header, because Slack drops the message rather than the text", () => {
    const long = "x".repeat(200);

    expect((header(long).text as { text: string }).text).toHaveLength(150);
  });

  it("builds the shapes Slack expects", () => {
    expect(header("Hi").type).toBe("header");
    expect(context("Hi").type).toBe("context");
    expect(divider()).toEqual({ type: "divider" });
    expect(section("Hi").type).toBe("section");
    expect(image("https://example.test/a.png", "alt")).toMatchObject({
      type: "image",
      image_url: "https://example.test/a.png",
      alt_text: "alt",
    });
  });

  it("caps actions at five, which is Slack's limit for one block", () => {
    const buttons = Array.from({ length: 8 }, (_, i) => ({
      label: `b${i}`,
      url: "https://example.test",
    }));

    expect((actions(buttons).elements as unknown[]).length).toBe(5);
  });
});

describe("table", () => {
  it("pads every column so the figures line up under each other", () => {
    const rendered = table([
      ["Measurements ingested", "3,689", "▼ 37%"],
      ["Devices active", "89", "▬ 0%"],
    ]);
    const [, first, second] = rendered.split("\n");

    expect(first.indexOf("3,689")).toBe(second.indexOf("89"));
  });

  it("wraps in a code block, the only place Slack keeps monospace", () => {
    const rendered = table([["a", "b"]]);

    expect(rendered.startsWith("```\n")).toBe(true);
    expect(rendered.endsWith("\n```")).toBe(true);
  });

  it("leaves no trailing whitespace on a short final cell", () => {
    const rendered = table([
      ["long name here", "1"],
      ["x", "2"],
    ]);

    for (const line of rendered.split("\n")) {
      expect(line).toBe(line.trimEnd());
    }
  });

  it("returns nothing for no rows, so a caller can omit the block", () => {
    expect(table([])).toBe("");
  });
});

describe("tableSections", () => {
  it("splits a long table so no section passes Slack's text limit, keeping the columns aligned", () => {
    const rows = Array.from({ length: 120 }, (_, index) => [
      `  ${index + 1}`,
      `Signal number ${index + 1} with a fairly long name`,
      "2h 27m",
      "312% above the last 4 Tuesdays",
    ]);

    const sections = tableSections(rows);

    expect(sections.length).toBeGreaterThan(1);
    for (const block of sections) {
      expect(JSON.stringify(block).length).toBeLessThanOrEqual(3000);
    }
    // The second line of the code block is the first data row.
    const secondLine = (block: SlackBlock) => JSON.stringify(block).split("\\n")[1] ?? "";
    expect(secondLine(sections[0]).indexOf("2h 27m")).toBe(
      secondLine(sections[1]).indexOf("2h 27m"),
    );
  });

  it("is one section for a short table", () => {
    expect(
      tableSections([
        ["a", "b"],
        ["c", "d"],
      ]),
    ).toHaveLength(1);
  });
});
