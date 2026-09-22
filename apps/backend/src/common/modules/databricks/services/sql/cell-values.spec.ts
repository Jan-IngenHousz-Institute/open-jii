import { cellNumber, cellString, cellUtcIso } from "./cell-values";

describe("cell-values", () => {
  it("reads blank or absent cells as null", () => {
    expect(cellString("  ")).toBeNull();
    expect(cellString(null)).toBeNull();
    expect(cellNumber("")).toBeNull();
    expect(cellNumber("not-a-number")).toBeNull();
    expect(cellNumber("42.5")).toBe(42.5);
  });

  it("anchors zone-less warehouse timestamps as UTC", () => {
    expect(cellUtcIso("2026-08-28 10:00:00")).toBe("2026-08-28T10:00:00.000Z");
    expect(cellUtcIso("2026-08-28T10:00:00.000Z")).toBe("2026-08-28T10:00:00.000Z");
    expect(cellUtcIso(null)).toBeNull();
    expect(cellUtcIso("junk")).toBeNull();
  });

  it("rejects impossible calendar dates instead of letting Date normalize them", () => {
    expect(cellUtcIso("2026-02-30 10:00:00")).toBeNull();
    expect(cellUtcIso("2026-04-31 00:00:00")).toBeNull();
    expect(cellUtcIso("2024-02-29 00:00:00")).toBe("2024-02-29T00:00:00.000Z");
  });
});
