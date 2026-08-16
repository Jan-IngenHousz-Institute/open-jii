import { describe, it, expect } from "vitest";

import { WellKnownColumnTypes } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { getColumnWidth } from "./data-table-columns";

describe("getColumnWidth", () => {
  it("should return 120 for ARRAY column type", () => {
    expect(getColumnWidth("ARRAY")).toBe(120);
  });

  it("should return 120 for ARRAY with generic type", () => {
    expect(getColumnWidth("ARRAY<STRING>")).toBe(120);
    expect(getColumnWidth("ARRAY<NUMBER>")).toBe(120);
    expect(getColumnWidth("ARRAY<INT>")).toBe(120);
  });

  it("should return 180 for MAP column type", () => {
    expect(getColumnWidth("MAP")).toBe(180);
  });

  it("should return 180 for MAP with STRING key type", () => {
    expect(getColumnWidth("MAP<STRING,")).toBe(180);
    expect(getColumnWidth("MAP<STRING,INT>")).toBe(180);
    expect(getColumnWidth("MAP<STRING,DOUBLE>")).toBe(180);
  });

  it("should return undefined for other column types", () => {
    expect(getColumnWidth("STRING")).toBeUndefined();
    expect(getColumnWidth("NUMBER")).toBeUndefined();
    expect(getColumnWidth("DOUBLE")).toBeUndefined();
    expect(getColumnWidth("INT")).toBeUndefined();
    expect(getColumnWidth("TIMESTAMP")).toBeUndefined();
    expect(getColumnWidth("BOOLEAN")).toBeUndefined();
    expect(getColumnWidth("ANNOTATIONS")).toBeUndefined();
  });

  it("should return undefined for empty string", () => {
    expect(getColumnWidth("")).toBeUndefined();
  });

  it("should return 180 for MAP with STRING key and space", () => {
    expect(getColumnWidth("MAP<STRING, STRING>")).toBe(180);
    expect(getColumnWidth("MAP<STRING, INT>")).toBe(180);
  });

  it("should return 180 for ARRAY<STRUCT<...>> column type", () => {
    expect(getColumnWidth("ARRAY<STRUCT<question_label: STRING>>")).toBe(180);
    expect(getColumnWidth("ARRAY<STRUCT<name: STRING, age: INT>>")).toBe(180);
    expect(
      getColumnWidth(
        "ARRAY<STRUCT<question_label: STRING, question_text: STRING, question_answer: STRING>>",
      ),
    ).toBe(180);
  });

  it("should return 120 for other ARRAY types", () => {
    expect(getColumnWidth("ARRAY")).toBe(120);
    expect(getColumnWidth("ARRAY<DOUBLE>")).toBe(120);
    expect(getColumnWidth("ARRAY<STRING>")).toBe(120);
  });

  it("should return 180 for USER column type", () => {
    expect(getColumnWidth(WellKnownColumnTypes.CONTRIBUTOR)).toBe(180);
  });

  it("should return fixed widths for time columns by name", () => {
    expect(getColumnWidth("STRING", "measurement_time_local")).toBe(220);
    expect(getColumnWidth("STRING", "local_time")).toBe(90);
    expect(getColumnWidth("STRING", "measurement_time_utc")).toBe(175);
  });

  it("should prioritize column name over type for time columns", () => {
    expect(getColumnWidth("ARRAY", "measurement_time_local")).toBe(220);
    expect(getColumnWidth("MAP", "local_time")).toBe(90);
    expect(getColumnWidth("TIMESTAMP", "measurement_time_utc")).toBe(175);
  });
});
