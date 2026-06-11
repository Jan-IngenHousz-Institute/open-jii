// Characterization tests for prepareMeasurementForUpload — pins today's
// payload construction (including quirks) so refactors can prove equivalence.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { __testing_prepareMeasurementForUpload as prepareMeasurementForUpload } from "~/features/recent-measurements/hooks/use-measurement-upload";

// Deterministic compression stand-in; records exactly what was compressed.
const mockCompressSample = vi.fn((sample: unknown) => `compressed:${JSON.stringify(sample)}`);

vi.mock("~/features/recent-measurements/utils/compress-sample", () => ({
  compressSample: (sample: unknown) => mockCompressSample(sample),
}));

// The module's other imports wrap native/env code that can't load in jsdom.
vi.mock("sonner-native", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("~/features/connection/utils/get-multispeq-mqtt-topic", () => ({
  getMultispeqMqttTopic: vi.fn(() => "topic"),
}));
vi.mock("~/features/recent-measurements/hooks/use-measurements", () => ({
  useMeasurements: vi.fn(),
}));
vi.mock("~/features/recent-measurements/services/export-measurements", () => ({
  exportSingleMeasurementToFile: vi.fn(),
}));
vi.mock("~/shared/composition/upload", () => ({ getOutbox: vi.fn() }));
vi.mock("~/shared/i18n", () => ({ useTranslation: vi.fn() }));
vi.mock("~/shared/ui/AlertDialog", () => ({ showAlert: vi.fn() }));

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

describe("prepareMeasurementForUpload payload construction", () => {
  it("builds the full payload: user_id, timestamp/timezone, macros, sample injection + compression markers, annotations", () => {
    const rawMeasurement = {
      device_id: "d-1",
      sample: [{ v: 1 }, { v: 2 }],
    };

    const payload = prepareMeasurementForUpload({
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
    // Macro filenames are injected BEFORE compression; the compressed input is
    // the caller's own (mutated) sample array.
    expect(mockCompressSample).toHaveBeenCalledTimes(1);
    expect(mockCompressSample).toHaveBeenCalledWith(rawMeasurement.sample);
    expect(payload.questions).toBe(QUESTIONS);
  });

  it("wraps a single (non-array) sample object for macro injection but compresses it unwrapped", () => {
    const sample = { v: 1 };
    const payload = prepareMeasurementForUpload({ ...baseArgs, rawMeasurement: { sample } });

    expect(sample).toStrictEqual({ v: 1, macros: ["macro_one.js"] });
    expect(payload.sample).toBe('compressed:{"v":1,"macros":["macro_one.js"]}');
    expect(payload._sample_encoding).toBe("gzip+base64");
  });

  it("null macro injects empty macros lists and an empty top-level macros array", () => {
    const rawMeasurement = { sample: [{ v: 1 }] };
    const payload = prepareMeasurementForUpload({ ...baseArgs, rawMeasurement, macro: null });

    expect(payload.macros).toStrictEqual([]);
    expect(rawMeasurement.sample[0]).toStrictEqual({ v: 1, macros: [] });
    expect(payload.sample).toBe('compressed:[{"v":1,"macros":[]}]');
  });

  it("macro with empty filename still appears in top-level macros but injects [] into samples", () => {
    const macro = { id: "m-2", name: "No File", filename: "" };
    const rawMeasurement = { sample: [{ v: 1 }] as { v: number; macros?: string[] }[] };
    const payload = prepareMeasurementForUpload({ ...baseArgs, rawMeasurement, macro });

    expect(payload.macros).toStrictEqual([macro]);
    expect(rawMeasurement.sample[0].macros).toStrictEqual([]);
  });

  it("no sample key: no compression, no _sample_encoding marker", () => {
    const payload = prepareMeasurementForUpload({ ...baseArgs, rawMeasurement: { device_id: "d" } });

    expect(mockCompressSample).not.toHaveBeenCalled();
    expect("sample" in payload).toBe(false);
    expect("_sample_encoding" in payload).toBe(false);
  });

  it("null sample survives untouched: no injection, no compression, no marker", () => {
    const payload = prepareMeasurementForUpload({ ...baseArgs, rawMeasurement: { sample: null } });

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
    const payload = prepareMeasurementForUpload({ ...baseArgs, rawMeasurement: { sample } });

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
    const payload = prepareMeasurementForUpload({ ...baseArgs, rawMeasurement: {}, commentText });

    expect(payload.annotations).toStrictEqual(expected);
  });

  // No flag input exists on this path: buildAnnotations supports flags but
  // only commentText is forwarded, so a flag annotation can never be emitted.
  it("never emits a flag annotation", () => {
    const payload = prepareMeasurementForUpload({ ...baseArgs, rawMeasurement: {}, commentText: "c" });

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

    const payload = prepareMeasurementForUpload({ ...baseArgs, rawMeasurement });

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

    const payload = prepareMeasurementForUpload({ ...baseArgs, rawMeasurement, commentText: "fresh" });

    expect(payload.annotations).toStrictEqual([
      { type: "comment", content: { text: "fresh", flagType: null } },
    ]);
    expect(payload._sample_encoding).toBe("gzip+base64");
  });

  it("caller _sample_encoding DOES survive when there is no sample to compress", () => {
    const payload = prepareMeasurementForUpload({
      ...baseArgs,
      rawMeasurement: { _sample_encoding: "caller-says-plaintext" },
    });

    expect(payload._sample_encoding).toBe("caller-says-plaintext");
  });
});

describe("in-place input mutation (current behavior)", () => {
  // Stage 1 will make prepareMeasurementForUpload pure; flip these
  // assertions deliberately when it lands.
  it("mutates the caller's sample entries by injecting macros", () => {
    const entryA = { v: 1 };
    const entryB = { v: 2, macros: ["pre-existing"] };
    const rawMeasurement = { sample: [entryA, entryB] };

    prepareMeasurementForUpload({ ...baseArgs, rawMeasurement });

    expect(entryA).toStrictEqual({ v: 1, macros: ["macro_one.js"] });
    // Pre-existing macros on a sample entry are overwritten, not merged.
    expect(entryB).toStrictEqual({ v: 2, macros: ["macro_one.js"] });
  });

  it("leaves rawMeasurement itself unmutated: sample stays the original (mutated-entry) array, not the compressed string", () => {
    const sampleArray = [{ v: 1 }];
    const rawMeasurement = { device_id: "d-1", sample: sampleArray };

    const payload = prepareMeasurementForUpload({ ...baseArgs, rawMeasurement });

    expect(rawMeasurement.sample).toBe(sampleArray);
    expect(payload.sample).not.toBe(rawMeasurement.sample);
    expect(Object.keys(rawMeasurement)).toStrictEqual(["device_id", "sample"]);
  });
});
