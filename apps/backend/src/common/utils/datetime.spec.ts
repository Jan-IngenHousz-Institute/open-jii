import { compactTimestamp, parseDatabricksTimestamp } from "./datetime";

describe("compactTimestamp", () => {
  it("formats an instant as YYYYMMDD_HHMMSS in UTC", () => {
    expect(compactTimestamp(new Date("2026-01-02T03:04:05.678Z"))).toBe("20260102_030405");
  });
});

describe("parseDatabricksTimestamp", () => {
  it("treats offset-less Databricks timestamps as UTC", () => {
    expect(parseDatabricksTimestamp("2026-01-02 03:04:05")?.toISOString()).toBe(
      "2026-01-02T03:04:05.000Z",
    );
    expect(parseDatabricksTimestamp("2026-01-02T03:04:05.123")?.toISOString()).toBe(
      "2026-01-02T03:04:05.123Z",
    );
  });

  it("accepts the six-digit fractions the SQL Statement API returns", () => {
    expect(parseDatabricksTimestamp("2026-01-02 03:04:05.123456")?.toISOString()).toBe(
      "2026-01-02T03:04:05.123Z",
    );
  });

  it("keeps an explicit offset intact", () => {
    expect(parseDatabricksTimestamp("2026-01-02T05:04:05+02:00")?.toISOString()).toBe(
      "2026-01-02T03:04:05.000Z",
    );
  });

  it("rejects impossible calendar dates instead of rolling them forward", () => {
    expect(parseDatabricksTimestamp("2026-02-30 03:04:05")).toBeNull();
    expect(parseDatabricksTimestamp("2026-13-01 03:04:05")).toBeNull();
    expect(parseDatabricksTimestamp("2026-01-32 03:04:05")).toBeNull();
  });

  it("still accepts real leap days", () => {
    expect(parseDatabricksTimestamp("2024-02-29 03:04:05")?.toISOString()).toBe(
      "2024-02-29T03:04:05.000Z",
    );
  });

  it("returns null for empty or unparsable values", () => {
    expect(parseDatabricksTimestamp(null)).toBeNull();
    expect(parseDatabricksTimestamp(undefined)).toBeNull();
    expect(parseDatabricksTimestamp("   ")).toBeNull();
    expect(parseDatabricksTimestamp("not-a-date")).toBeNull();
  });
});
