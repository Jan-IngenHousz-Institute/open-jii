import { numericStringOrder } from "./numeric-string-order";

const sql = numericStringOrder("`answer`", "ASC");
const pattern = /RLIKE '([^']+)'/.exec(sql)?.[1];
if (!pattern) throw new Error("Numeric ordering must guard decimal conversion");
const representable = new RegExp(pattern);

describe("numericStringOrder", () => {
  it.each([
    "0",
    "-0",
    "+0",
    "-.0",
    ".5",
    "1.",
    "+001.50",
    "99999999999999999999.999999999999999999",
    "-99999999999999999999.999999999999999999",
    "0.000000000000000001",
    "1.1234567890123456780000",
    "00000000000000000000000000002",
    "1.000000000000000000000000000000",
  ])("accepts exactly representable decimal %s", (value) => {
    expect(representable.test(value)).toBe(true);
  });

  it.each([
    "",
    ".",
    "+",
    "-",
    "+-1",
    "--1",
    "1.2.3",
    "1 2",
    "1e3",
    "1E-3",
    "0x1F",
    "1,000",
    "1_000",
    "12abc",
    "NaN",
    "-Infinity",
    "inf",
    "٣",
    "１２",
    "100000000000000000000",
    "-100000000000000000000",
    "0.0000000000000000001",
    "1.0000000000000000001",
    "0.9999999999999999999",
  ])("keeps unsupported answer %s out of numeric conversion", (value) => {
    expect(representable.test(value)).toBe(false);
  });

  it.each(["ASC", "DESC"] as const)(
    "keeps groups fixed and original-value/id ties deterministic for %s",
    (direction) => {
      const result = numericStringOrder("`answer`", direction, "`id`");
      expect(result).toContain("THEN 0 WHEN");
      expect(result).toContain("THEN 2 ELSE 1 END ASC,");
      expect(result).toContain(
        `AS DECIMAL(38, 18)) END) ${direction}, \`answer\` ${direction} NULLS LAST, \`id\` ASC`,
      );
      expect(result).not.toMatch(/\b(?:DOUBLE|FLOAT)\b/);
    },
  );

  it("uses the same readable ASCII whitespace trim for numeric and blank detection", () => {
    expect(sql).toContain(
      "trim(BOTH concat(char(9), char(10), char(11), char(12), char(13), ' ') FROM `answer`)",
    );
    expect([...sql].every((character) => character.charCodeAt(0) >= 32)).toBe(true);
    expect(sql).not.toContain("`id`");
  });
});
