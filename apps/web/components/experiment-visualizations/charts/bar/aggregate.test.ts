import { describe, expect, it } from "vitest";

import { WellKnownColumnTypes } from "@repo/api/schemas/experiment.schema";

import {
  applyRowFilters,
  applyTopN,
  collectQuestionLabels,
  groupAndAggregate,
  parseContributorCell,
  parseQuestionsCell,
  UNKNOWN_KEY,
  UNKNOWN_LABEL,
} from "./aggregate";
import type { AggregatedBucket } from "./aggregate";

describe("parseContributorCell", () => {
  it("returns null for null, undefined, and empty string", () => {
    expect(parseContributorCell(null)).toBeNull();
    expect(parseContributorCell(undefined)).toBeNull();
    expect(parseContributorCell("")).toBeNull();
  });

  it("parses a JSON-string contributor", () => {
    const c = parseContributorCell('{"id":"u1","name":"Ada","avatar":"https://x/y"}');
    expect(c).toEqual({ id: "u1", name: "Ada", avatar: "https://x/y" });
  });

  it("accepts an already-parsed contributor object", () => {
    const c = parseContributorCell({ id: "u2", name: "Grace", avatar: null });
    expect(c).toEqual({ id: "u2", name: "Grace", avatar: null });
  });

  it("treats a missing avatar as null", () => {
    const c = parseContributorCell('{"id":"u3","name":"Linus"}');
    expect(c).toEqual({ id: "u3", name: "Linus", avatar: null });
  });

  it("returns null when JSON is malformed", () => {
    expect(parseContributorCell("{not json")).toBeNull();
  });

  it("returns null when JSON parses to a non-contributor shape", () => {
    expect(parseContributorCell('{"foo":"bar"}')).toBeNull();
    expect(parseContributorCell('"just a string"')).toBeNull();
    expect(parseContributorCell("42")).toBeNull();
  });
});

const CONTRIBUTOR_TYPE = WellKnownColumnTypes.CONTRIBUTOR;

function contributorCell(id: string, name: string) {
  return JSON.stringify({ id, name, avatar: null });
}

describe("groupAndAggregate", () => {
  it("returns an empty list when xColumn is undefined", () => {
    expect(groupAndAggregate([{ a: 1 }], undefined, undefined, undefined, "count")).toEqual([]);
  });

  it("counts rows per contributor and labels by name", () => {
    const rows = [
      { contributor: contributorCell("u1", "Ada"), phi2: 0.8 },
      { contributor: contributorCell("u2", "Grace"), phi2: 0.5 },
      { contributor: contributorCell("u1", "Ada"), phi2: 0.9 },
    ];
    const out = groupAndAggregate(rows, "contributor", CONTRIBUTOR_TYPE, undefined, "count");
    expect(out).toHaveLength(2);
    const byKey = new Map(out.map((b) => [b.key, b]));
    expect(byKey.get("u1")).toMatchObject({ label: "Ada", value: 2, count: 2 });
    expect(byKey.get("u2")).toMatchObject({ label: "Grace", value: 1, count: 1 });
  });

  it("buckets null/missing contributors under Unknown", () => {
    const rows = [
      { contributor: contributorCell("u1", "Ada") },
      { contributor: null },
      { contributor: "" },
      { contributor: "{garbage" },
    ];
    const out = groupAndAggregate(rows, "contributor", CONTRIBUTOR_TYPE, undefined, "count");
    const unknown = out.find((b) => b.key === UNKNOWN_KEY);
    expect(unknown).toMatchObject({ label: UNKNOWN_LABEL, value: 3, count: 3 });
  });

  it("computes mean of a numeric column per group", () => {
    const rows = [
      { contributor: contributorCell("u1", "Ada"), phi2: 0.8 },
      { contributor: contributorCell("u1", "Ada"), phi2: 0.4 },
      { contributor: contributorCell("u2", "Grace"), phi2: 0.6 },
    ];
    const out = groupAndAggregate(rows, "contributor", CONTRIBUTOR_TYPE, "phi2", "avg");
    const byKey = new Map(out.map((b) => [b.key, b]));
    expect(byKey.get("u1")?.value).toBeCloseTo(0.6);
    expect(byKey.get("u2")?.value).toBeCloseTo(0.6);
  });

  it("skips non-numeric and empty cells when aggregating numerically", () => {
    const rows = [
      { contributor: contributorCell("u1", "Ada"), phi2: 1 },
      { contributor: contributorCell("u1", "Ada"), phi2: null },
      { contributor: contributorCell("u1", "Ada"), phi2: "" },
      { contributor: contributorCell("u1", "Ada"), phi2: "not a number" },
      { contributor: contributorCell("u1", "Ada"), phi2: 3 },
    ];
    const out = groupAndAggregate(rows, "contributor", CONTRIBUTOR_TYPE, "phi2", "avg");
    expect(out).toHaveLength(1);
    expect(out[0].value).toBeCloseTo(2);
    expect(out[0].count).toBe(5);
  });

  it("returns 0 when no numeric values fall into a bucket (avg/min/max degenerate)", () => {
    const rows = [
      { contributor: contributorCell("u1", "Ada"), phi2: null },
      { contributor: contributorCell("u1", "Ada"), phi2: "" },
    ];
    const out = groupAndAggregate(rows, "contributor", CONTRIBUTOR_TYPE, "phi2", "avg");
    expect(out[0].value).toBe(0);
    expect(out[0].count).toBe(2);
  });

  it("coerces numeric strings (silver-layer columns commonly store '5.3' as STRING)", () => {
    const rows = [
      { contributor: contributorCell("u1", "Ada"), phi2: "0.8" },
      { contributor: contributorCell("u1", "Ada"), phi2: "0.4" },
    ];
    const out = groupAndAggregate(rows, "contributor", CONTRIBUTOR_TYPE, "phi2", "avg");
    expect(out[0].value).toBeCloseTo(0.6);
  });

  it("computes max and min", () => {
    const rows = [
      { contributor: contributorCell("u1", "Ada"), phi2: 0.4 },
      { contributor: contributorCell("u1", "Ada"), phi2: 0.9 },
      { contributor: contributorCell("u2", "Grace"), phi2: 0.6 },
    ];
    const max = groupAndAggregate(rows, "contributor", CONTRIBUTOR_TYPE, "phi2", "max");
    const min = groupAndAggregate(rows, "contributor", CONTRIBUTOR_TYPE, "phi2", "min");
    const maxByKey = new Map(max.map((b) => [b.key, b.value]));
    const minByKey = new Map(min.map((b) => [b.key, b.value]));
    expect(maxByKey.get("u1")).toBeCloseTo(0.9);
    expect(maxByKey.get("u2")).toBeCloseTo(0.6);
    expect(minByKey.get("u1")).toBeCloseTo(0.4);
  });

  it("groups by a categorical column using string-key", () => {
    const rows = [
      { team: "A", v: 1 },
      { team: "A", v: 2 },
      { team: "B", v: 3 },
      { team: null, v: 4 },
    ];
    const out = groupAndAggregate(rows, "team", "STRING", "v", "sum");
    const byKey = new Map(out.map((b) => [b.key, b.value]));
    expect(byKey.get("A")).toBe(3);
    expect(byKey.get("B")).toBe(3);
    expect(byKey.get(UNKNOWN_KEY)).toBe(4);
  });

  it("groups by a numeric / boolean cell by stringifying it", () => {
    const rows = [
      { pass: true, score: 1 },
      { pass: false, score: 2 },
      { pass: true, score: 3 },
    ];
    const numeric = groupAndAggregate(
      [{ n: 1 }, { n: 2 }, { n: 1 }],
      "n",
      "BIGINT",
      undefined,
      "count",
    );
    expect(new Map(numeric.map((b) => [b.key, b.value]))).toEqual(
      new Map([
        ["1", 2],
        ["2", 1],
      ]),
    );
    const byPass = groupAndAggregate(rows, "pass", "BOOLEAN", "score", "sum");
    const map = new Map(byPass.map((b) => [b.key, b.value]));
    expect(map.get("true")).toBe(4);
    expect(map.get("false")).toBe(2);
  });

  it("buckets unsupported cell types (objects / arrays) into Unknown", () => {
    const out = groupAndAggregate(
      [{ x: { foo: "bar" } }, { x: [1, 2] }],
      "x",
      "STRING",
      undefined,
      "count",
    );
    expect(out).toEqual([{ key: UNKNOWN_KEY, label: UNKNOWN_LABEL, value: 2, count: 2 }]);
  });
});

const QUESTIONS_TYPE = WellKnownColumnTypes.QUESTIONS;

function questionEntry(label: string, answer: string | null) {
  return {
    question_label: label,
    question_text: `Text for ${label}`,
    question_answer: answer,
  };
}

describe("parseQuestionsCell", () => {
  it("accepts a pre-parsed array of entries", () => {
    const arr = [questionEntry("Plot", "A1"), questionEntry("Crop", "Maize")];
    const parsed = parseQuestionsCell(arr);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ questionLabel: "Plot", questionAnswer: "A1" });
  });

  it("parses a JSON-string array", () => {
    const raw = JSON.stringify([questionEntry("Plot", "A1")]);
    expect(parseQuestionsCell(raw)).toEqual([
      { questionLabel: "Plot", questionText: "Text for Plot", questionAnswer: "A1" },
    ]);
  });

  it("returns [] for null / empty / non-array", () => {
    expect(parseQuestionsCell(null)).toEqual([]);
    expect(parseQuestionsCell("")).toEqual([]);
    expect(parseQuestionsCell("{not json")).toEqual([]);
    expect(parseQuestionsCell({ foo: "bar" })).toEqual([]);
  });

  it("ignores entries with no question_label", () => {
    const arr = [{ question_text: "orphan" }, questionEntry("Plot", "A1")];
    expect(parseQuestionsCell(arr)).toEqual([
      { questionLabel: "Plot", questionText: "Text for Plot", questionAnswer: "A1" },
    ]);
  });
});

describe("groupAndAggregate (QUESTIONS column)", () => {
  it("buckets rows by the answer to the picked question label", () => {
    const rows = [
      { qs: [questionEntry("Plot", "A1"), questionEntry("Crop", "Maize")] },
      { qs: [questionEntry("Plot", "A1"), questionEntry("Crop", "Wheat")] },
      { qs: [questionEntry("Plot", "B2"), questionEntry("Crop", "Wheat")] },
    ];
    const byPlot = groupAndAggregate(rows, "qs", QUESTIONS_TYPE, undefined, "count", {
      questionLabel: "Plot",
    });
    const map = new Map(byPlot.map((b) => [b.key, b]));
    expect(map.get("A1")?.value).toBe(2);
    expect(map.get("B2")?.value).toBe(1);
  });

  it("collapses to Unknown when the picked label is missing on a row", () => {
    const rows = [
      { qs: [questionEntry("Plot", "A1")] },
      { qs: [questionEntry("Crop", "Wheat")] }, // no Plot answer
      { qs: null },
    ];
    const out = groupAndAggregate(rows, "qs", QUESTIONS_TYPE, undefined, "count", {
      questionLabel: "Plot",
    });
    const map = new Map(out.map((b) => [b.key, b]));
    expect(map.get("A1")?.value).toBe(1);
    expect(map.get(UNKNOWN_KEY)?.value).toBe(2);
  });

  it("returns one Unknown bucket when no questionLabel is configured", () => {
    const rows = [{ qs: [questionEntry("Plot", "A1")] }];
    const out = groupAndAggregate(rows, "qs", QUESTIONS_TYPE, undefined, "count");
    expect(out).toEqual([{ key: UNKNOWN_KEY, label: UNKNOWN_LABEL, value: 1, count: 1 }]);
  });

  it("aggregates a numeric Y per question-answer bucket", () => {
    const rows = [
      { qs: [questionEntry("Plot", "A1")], phi2: 0.4 },
      { qs: [questionEntry("Plot", "A1")], phi2: 0.6 },
      { qs: [questionEntry("Plot", "B2")], phi2: 0.9 },
    ];
    const out = groupAndAggregate(rows, "qs", QUESTIONS_TYPE, "phi2", "avg", {
      questionLabel: "Plot",
    });
    const map = new Map(out.map((b) => [b.key, b]));
    expect(map.get("A1")?.value).toBeCloseTo(0.5);
    expect(map.get("B2")?.value).toBeCloseTo(0.9);
  });
});

describe("collectQuestionLabels", () => {
  it("returns unique labels in first-seen order across rows", () => {
    const rows = [
      { qs: [questionEntry("Plot", "A1"), questionEntry("Crop", "Maize")] },
      { qs: [questionEntry("Crop", "Wheat")] },
      { qs: [questionEntry("Site", "North")] },
      { qs: null },
    ];
    expect(collectQuestionLabels(rows, "qs")).toEqual(["Plot", "Crop", "Site"]);
  });

  it("returns [] for missing column", () => {
    expect(collectQuestionLabels([{ qs: [] }], undefined)).toEqual([]);
  });
});

describe("applyTopN", () => {
  function makeBuckets(values: number[]): AggregatedBucket[] {
    return values.map((v, i) => ({
      key: `k${i}`,
      label: `L${i}`,
      value: v,
      count: 1,
    }));
  }

  it("returns input order when sortDirection is null/undefined", () => {
    const buckets = makeBuckets([5, 1, 3]);
    expect(applyTopN(buckets, null, undefined).map((b) => b.value)).toEqual([5, 1, 3]);
    expect(applyTopN(buckets, undefined, undefined).map((b) => b.value)).toEqual([5, 1, 3]);
  });

  it("sorts descending and limits to topN", () => {
    const buckets = makeBuckets([5, 1, 9, 3, 7]);
    const out = applyTopN(buckets, "desc", 3);
    expect(out.map((b) => b.value)).toEqual([9, 7, 5]);
  });

  it("sorts ascending", () => {
    const buckets = makeBuckets([5, 1, 9, 3, 7]);
    const out = applyTopN(buckets, "asc", undefined);
    expect(out.map((b) => b.value)).toEqual([1, 3, 5, 7, 9]);
  });

  it("does not trim when topN >= length", () => {
    const buckets = makeBuckets([1, 2, 3]);
    expect(applyTopN(buckets, "desc", 99)).toHaveLength(3);
  });

  it("ignores invalid topN (0 or negative)", () => {
    const buckets = makeBuckets([5, 1, 9]);
    expect(applyTopN(buckets, "desc", 0)).toHaveLength(3);
    expect(applyTopN(buckets, "desc", -1)).toHaveLength(3);
  });
});

describe("applyRowFilters", () => {
  const rows = [
    { school: "Lincoln", team: "Red", v: 1 },
    { school: "Lincoln", team: "Blue", v: 2 },
    { school: "Madison", team: "Red", v: 3 },
    { school: "Madison", team: "Blue", v: 4 },
    { school: null, team: "Red", v: 5 },
  ];

  it("returns rows unchanged when filters is undefined or empty", () => {
    expect(applyRowFilters(rows, undefined)).toEqual(rows);
    expect(applyRowFilters(rows, [])).toEqual(rows);
  });

  it("ignores half-configured filters (empty column or value)", () => {
    expect(applyRowFilters(rows, [{ column: "", operator: "equals", value: "Lincoln" }])).toEqual(
      rows,
    );
    expect(applyRowFilters(rows, [{ column: "school", operator: "equals", value: "" }])).toEqual(
      rows,
    );
  });

  it("keeps only rows matching every active filter (AND semantics)", () => {
    const out = applyRowFilters(rows, [{ column: "school", operator: "equals", value: "Lincoln" }]);
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.school === "Lincoln")).toBe(true);

    const both = applyRowFilters(rows, [
      { column: "school", operator: "equals", value: "Madison" },
      { column: "team", operator: "equals", value: "Blue" },
    ]);
    expect(both).toEqual([{ school: "Madison", team: "Blue", v: 4 }]);
  });

  it("drops rows where the filtered cell is null", () => {
    const out = applyRowFilters(rows, [{ column: "school", operator: "equals", value: "Lincoln" }]);
    expect(out.some((r) => r.school === null)).toBe(false);
  });
});
