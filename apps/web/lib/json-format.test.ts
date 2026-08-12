import { describe, expect, it } from "vitest";

import { formatJson, isJsonFormatStyle, reformatJsonString } from "./json-format";

describe("formatJson", () => {
  it("matches JSON.stringify indentation in expanded style", () => {
    const value = { a: [1, 2, 3] };
    expect(formatJson(value, { style: "expanded" })).toBe(JSON.stringify(value, null, 2));
  });

  it("keeps a long numeric array on one line in compact style", () => {
    const pulses = Array.from({ length: 40 }, (_, i) => i + 1);
    const compact = formatJson([{ pulses }], { style: "compact" });

    // `[`, `{`, the one-line pulses array, `}`, `]`
    expect(compact.split("\n")).toHaveLength(5);
    expect(compact).toContain(`"pulses": [${pulses.join(", ")}]`);
    expect(JSON.parse(compact)).toEqual([{ pulses }]);
  });

  it("keeps arrays of scalar arrays on one line", () => {
    const value = {
      pulsed_lights: Array.from({ length: 40 }, () => [3]),
      detectors: [[1], [1]],
    };
    const compact = formatJson(value, { style: "compact" });
    const lines = compact.split("\n");

    expect(lines).toHaveLength(4);
    expect(lines[1]).toBe(
      `  "pulsed_lights": [${Array.from({ length: 40 }, () => "[3]").join(", ")}],`,
    );
    expect(JSON.parse(compact)).toEqual(value);
  });

  it("breaks a struct-shaped array that does not fit", () => {
    const value = Array.from({ length: 6 }, (_, i) => ({ label: `set ${i}`, pulses: [1, 2] }));
    const lines = formatJson(value, { style: "compact" }).split("\n");

    expect(lines).toHaveLength(8);
    expect(lines[0]).toBe("[");
    expect(lines[1]).toBe(`  {"label": "set 0", "pulses": [1, 2]},`);
    expect(JSON.parse(lines.join("\n"))).toEqual(value);
  });

  it("falls back to one element per line past the data-array budget", () => {
    const value = { samples: Array.from({ length: 2000 }, (_, i) => i) };
    const lines = formatJson(value, { style: "compact" }).split("\n");

    expect(lines.length).toBeGreaterThan(2000);
    expect(JSON.parse(lines.join("\n"))).toEqual(value);
  });

  it("accounts for the key prefix when measuring line width", () => {
    const value = { aVeryLongKeyNameThatEatsIntoTheBudget: { nested: "value" } };
    const compact = formatJson(value, { style: "compact", maxLineWidth: 45 });

    expect(compact.split("\n").length).toBeGreaterThan(3);
    expect(JSON.parse(compact)).toEqual(value);
  });

  it("round-trips nested structures", () => {
    const value = [
      { label: "set 1", pulses: [10, 20], detectors: [[1], [1]], meta: { nested: { deep: true } } },
      { label: "set 2", pulses: Array.from({ length: 100 }, (_, i) => i) },
    ];
    expect(JSON.parse(formatJson(value, { style: "compact" }))).toEqual(value);
    expect(JSON.parse(formatJson(value, { style: "expanded" }))).toEqual(value);
  });

  it("renders empty containers inline", () => {
    expect(formatJson([], { style: "compact" })).toBe("[]");
    expect(formatJson({}, { style: "compact" })).toBe("{}");
  });

  it("returns an empty string for undefined", () => {
    expect(formatJson(undefined)).toBe("");
  });

  it("does not split a single long string", () => {
    const value = "x".repeat(500);
    expect(formatJson(value, { style: "compact" })).toBe(JSON.stringify(value));
  });

  it("skips undefined object values like JSON.stringify does", () => {
    const value = { keep: Array.from({ length: 60 }, () => 1), drop: undefined };
    const compact = formatJson(value, { style: "compact" });
    expect(compact).not.toContain("drop");
    expect(JSON.parse(compact)).toEqual({ keep: value.keep });
  });
});

describe("reformatJsonString", () => {
  it("reformats valid JSON", () => {
    const pulses = Array.from({ length: 40 }, () => 1);
    const source = JSON.stringify({ pulses }, null, 2);
    expect(source.split("\n")).toHaveLength(44);
    expect(reformatJsonString(source, { style: "compact" }).split("\n")).toHaveLength(3);
  });

  it("collapses a realistic MultispeQ protocol", () => {
    const protocol = [
      {
        label: "PAM",
        pulses: Array.from({ length: 40 }, () => 20),
        pulse_length: [[30], [30]],
        pulsed_lights: [[3], [4]],
        detectors: [[1], [1]],
      },
    ];
    const expanded = formatJson(protocol, { style: "expanded" });
    const compact = formatJson(protocol, { style: "compact" });

    expect(expanded.split("\n").length).toBeGreaterThan(50);
    expect(compact.split("\n")).toHaveLength(9);
    expect(JSON.parse(compact)).toEqual(protocol);
  });

  it("leaves invalid JSON untouched", () => {
    expect(reformatJsonString("{ not json", { style: "compact" })).toBe("{ not json");
  });

  it("leaves blank input untouched", () => {
    expect(reformatJsonString("   ")).toBe("   ");
  });
});

describe("isJsonFormatStyle", () => {
  it("accepts known styles only", () => {
    expect(isJsonFormatStyle("compact")).toBe(true);
    expect(isJsonFormatStyle("expanded")).toBe(true);
    expect(isJsonFormatStyle("pretty")).toBe(false);
    expect(isJsonFormatStyle(null)).toBe(false);
  });
});
