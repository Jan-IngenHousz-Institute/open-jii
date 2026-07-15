// Characterization tests for buildUploadPayload — pins the payload
// construction (including quirks) so refactors can prove equivalence.
// Pure since Stage 1: input mutation assertions flipped deliberately.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildUploadPayload } from "~/features/recent-measurements/services/build-upload-payload";

// Deterministic compression stand-in; records exactly what was compressed.
const mockCompressSample = vi.fn((sample: unknown) => `compressed:${JSON.stringify(sample)}`);

vi.mock("~/features/recent-measurements/utils/compress-sample", () => ({
  compressSample: (sample: unknown) => mockCompressSample(sample),
}));

const MACRO = { id: "m-1", name: "Macro One", filename: "macro_one.js" };
const QUESTIONS = [{ question_label: "q1", question_text: "Q?", question_answer: "A" }];

const baseArgs = {
  userId: "user-1",
  macro: MACRO,
  timestamp: "2026-01-01T10:00:00Z",
  timezone: "Europe/Amsterdam",
  questions: QUESTIONS,
  commentText: undefined as string | undefined,
};

beforeEach(() => {
  mockCompressSample.mockClear();
});

describe("buildUploadPayload payload construction", () => {
  it("builds the full payload: user_id, timestamp/timezone, macros, sample injection + compression markers, annotations", () => {
    const rawMeasurement = {
      device_id: "d-1",
      sample: [{ v: 1 }, { v: 2 }],
    };

    const payload = buildUploadPayload({
      ...baseArgs,
      rawMeasurement,
      commentText: "hello",
    });

    expect(payload).toStrictEqual({
      questions: QUESTIONS,
      macros: [MACRO],
      timestamp: "2026-01-01T10:00:00Z",
      timezone: "Europe/Amsterdam",
      user_id: "user-1",
      device_id: "d-1",
      sample: 'compressed:[{"v":1,"macros":["macro_one.js"]},{"v":2,"macros":["macro_one.js"]}]',
      _sample_encoding: "gzip+base64",
      annotations: [{ type: "comment", content: { text: "hello", flagType: null } }],
    });
    // Macro filenames are injected into CLONED entries before compression;
    // the caller's array is never the compression input.
    expect(mockCompressSample).toHaveBeenCalledTimes(1);
    expect(mockCompressSample).toHaveBeenCalledWith([
      { v: 1, macros: ["macro_one.js"] },
      { v: 2, macros: ["macro_one.js"] },
    ]);
    expect(rawMeasurement.sample).toStrictEqual([{ v: 1 }, { v: 2 }]);
    expect(payload.questions).toBe(QUESTIONS);
  });

  it("wraps a single (non-array) sample object for macro injection but compresses it unwrapped", () => {
    const sample = { v: 1 };
    const payload = buildUploadPayload({ ...baseArgs, rawMeasurement: { sample } });

    expect(sample).toStrictEqual({ v: 1 });
    expect(payload.sample).toBe('compressed:{"v":1,"macros":["macro_one.js"]}');
    expect(payload._sample_encoding).toBe("gzip+base64");
  });

  it("null macro injects empty macros lists and an empty top-level macros array", () => {
    const rawMeasurement = { sample: [{ v: 1 }] };
    const payload = buildUploadPayload({ ...baseArgs, rawMeasurement, macro: null });

    expect(payload.macros).toStrictEqual([]);
    expect(rawMeasurement.sample[0]).toStrictEqual({ v: 1 });
    expect(payload.sample).toBe('compressed:[{"v":1,"macros":[]}]');
  });

  it("macro with empty filename still appears in top-level macros but injects [] into samples", () => {
    const macro = { id: "m-2", name: "No File", filename: "" };
    const rawMeasurement = { sample: [{ v: 1 }] as { v: number; macros?: string[] }[] };
    const payload = buildUploadPayload({ ...baseArgs, rawMeasurement, macro });

    expect(payload.macros).toStrictEqual([macro]);
    expect(rawMeasurement.sample[0].macros).toBeUndefined();
    expect(mockCompressSample).toHaveBeenCalledWith([{ v: 1, macros: [] }]);
  });

  it("no sample key: no compression, no _sample_encoding marker", () => {
    const payload = buildUploadPayload({ ...baseArgs, rawMeasurement: { device_id: "d" } });

    expect(mockCompressSample).not.toHaveBeenCalled();
    expect("sample" in payload).toBe(false);
    expect("_sample_encoding" in payload).toBe(false);
  });

  it("null sample survives untouched: no injection, no compression, no marker", () => {
    const payload = buildUploadPayload({ ...baseArgs, rawMeasurement: { sample: null } });

    expect(payload.sample).toBeNull();
    expect("_sample_encoding" in payload).toBe(false);
    expect(mockCompressSample).not.toHaveBeenCalled();
  });

  // Quirk: falsy-but-non-null sample (0, "") skips macro injection (truthiness
  // guard) yet still gets compressed + marked (`!= null` guard).
  it.each([
    [0, "compressed:0"],
    ["", 'compressed:""'],
  ])("falsy sample %j skips macro injection but is still compressed", (sample, compressed) => {
    const payload = buildUploadPayload({ ...baseArgs, rawMeasurement: { sample } });

    expect(payload.sample).toBe(compressed);
    expect(payload._sample_encoding).toBe("gzip+base64");
  });
});

describe("annotations", () => {
  it.each([
    ["hello", [{ type: "comment", content: { text: "hello", flagType: null } }]],
    ["  padded  ", [{ type: "comment", content: { text: "padded", flagType: null } }]],
    ["   ", []],
    ["", []],
    [undefined, []],
  ])("commentText %j -> %j", (commentText, expected) => {
    const payload = buildUploadPayload({ ...baseArgs, rawMeasurement: {}, commentText });

    expect(payload.annotations).toStrictEqual(expected);
  });

  // No flag input exists on this path: buildAnnotations supports flags but
  // only commentText is forwarded, so a flag annotation can never be emitted.
  it("never emits a flag annotation", () => {
    const payload = buildUploadPayload({ ...baseArgs, rawMeasurement: {}, commentText: "c" });

    expect(payload.annotations.every((a: { type: string }) => a.type === "comment")).toBe(true);
  });
});

describe("...rawMeasurement spread-order semantics", () => {
  // rawMeasurement spreads AFTER the built keys, so caller-supplied
  // questions/macros/timestamp/timezone/user_id silently win.
  it("caller keys override built questions/macros/timestamp/timezone/user_id", () => {
    const rawMeasurement = {
      questions: [{ question_label: "x", question_text: "X?", question_answer: "Y" }],
      macros: ["raw-macro"],
      timestamp: "1999-12-31T23:59:59Z",
      timezone: "UTC",
      user_id: "impostor",
    };

    const payload = buildUploadPayload({ ...baseArgs, rawMeasurement });

    expect(payload.questions).toBe(rawMeasurement.questions);
    expect(payload.macros).toBe(rawMeasurement.macros);
    expect(payload.timestamp).toBe("1999-12-31T23:59:59Z");
    expect(payload.timezone).toBe("UTC");
    expect(payload.user_id).toBe("impostor");
  });

  // annotations and _sample_encoding are written AFTER the spread, so the
  // caller can never override those two.
  it("built annotations always replace caller-supplied annotations", () => {
    const rawMeasurement = {
      annotations: [{ type: "comment", content: { text: "stale", flagType: null } }],
      sample: [{ v: 1 }],
      _sample_encoding: "caller-says-plaintext",
    };

    const payload = buildUploadPayload({ ...baseArgs, rawMeasurement, commentText: "fresh" });

    expect(payload.annotations).toStrictEqual([
      { type: "comment", content: { text: "fresh", flagType: null } },
    ]);
    expect(payload._sample_encoding).toBe("gzip+base64");
  });

  it("caller _sample_encoding DOES survive when there is no sample to compress", () => {
    const payload = buildUploadPayload({
      ...baseArgs,
      rawMeasurement: { _sample_encoding: "caller-says-plaintext" },
    });

    expect(payload._sample_encoding).toBe("caller-says-plaintext");
  });
});

describe("input purity", () => {
  it("never mutates the caller's sample entries; payload entries get macros overwritten, not merged", () => {
    const entryA = { v: 1 };
    const entryB = { v: 2, macros: ["pre-existing"] };
    const rawMeasurement = { sample: [entryA, entryB] };

    buildUploadPayload({ ...baseArgs, rawMeasurement });

    expect(entryA).toStrictEqual({ v: 1 });
    expect(entryB).toStrictEqual({ v: 2, macros: ["pre-existing"] });
    // Pre-existing macros on a sample entry are overwritten in the payload.
    expect(mockCompressSample).toHaveBeenCalledWith([
      { v: 1, macros: ["macro_one.js"] },
      { v: 2, macros: ["macro_one.js"] },
    ]);
  });

  it("leaves rawMeasurement itself unmutated: sample stays the original array, payload gets the compressed string", () => {
    const sampleArray = [{ v: 1 }];
    const rawMeasurement = { device_id: "d-1", sample: sampleArray };

    const payload = buildUploadPayload({ ...baseArgs, rawMeasurement });

    expect(rawMeasurement.sample).toBe(sampleArray);
    expect(sampleArray[0]).toStrictEqual({ v: 1 });
    expect(payload.sample).not.toBe(rawMeasurement.sample);
    expect(Object.keys(rawMeasurement)).toStrictEqual(["device_id", "sample"]);
  });
});

describe("workbook run correlation", () => {
  it("stamps workbook_run_id when given, alongside sample compression", () => {
    const payload = buildUploadPayload({
      ...baseArgs,
      rawMeasurement: { device_id: "MSPx-0001", sample: [{ data_raw: [1, 2] }] },
      workbookRunId: "run-1",
    });

    expect(payload.workbook_run_id).toBe("run-1");
    expect(payload._sample_encoding).toBe("gzip+base64");
    expect(typeof payload.sample).toBe("string");
  });

  it("omits workbook_run_id when not linked to a round", () => {
    const payload = buildUploadPayload({
      ...baseArgs,
      rawMeasurement: { device_id: "MSPx-0001" },
    });

    expect(payload).not.toHaveProperty("workbook_run_id");
  });

  it("falls back to the local device id only when the firmware did not supply one", () => {
    const withFirmwareId = buildUploadPayload({
      ...baseArgs,
      rawMeasurement: { device_id: "MSPx-0001" },
      fallbackDeviceId: "42",
    });
    expect(withFirmwareId.device_id).toBe("MSPx-0001");

    const withoutFirmwareId = buildUploadPayload({
      ...baseArgs,
      rawMeasurement: {},
      fallbackDeviceId: "42",
    });
    expect(withoutFirmwareId.device_id).toBe("42");

    const withNeither = buildUploadPayload({
      ...baseArgs,
      rawMeasurement: {},
    });
    expect(withNeither).not.toHaveProperty("device_id");
  });
});
