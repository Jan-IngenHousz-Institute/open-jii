import { describe, expect, it, vi } from "vitest";
import type { StoredMeasurement } from "~/shared/db/measurements-storage";

import { resolveMacroPreviewSource } from "./resolve-macro-preview-source";

vi.mock("~/shared/stores/device-identity-store", () => ({
  getLocalThingName: () => "mobile-test-thing",
}));
vi.mock("expo-application", () => ({ nativeApplicationVersion: "2.4.1" }));

const EXPERIMENT_ID = "11111111-1111-1111-1111-111111111111";
const PROTOCOL_ID = "22222222-2222-2222-2222-222222222222";
const TOPIC = `experiment/data_ingest/v1/${EXPERIMENT_ID}/multispeq/v1.0/client-1/${PROTOCOL_ID}`;

function measurement(payload: Record<string, unknown>, topic = TOPIC): StoredMeasurement {
  return {
    id: "m1",
    status: "successful",
    data: {
      topic,
      measurementResult: payload,
      metadata: { experimentName: "Exp", protocolName: "proto", timestamp: "2026-08-01T10:00:00Z" },
    },
  };
}

const fullPayload = {
  macros: [{ id: "macro-1", name: "Phi2", filename: "macro-1.js" }],
  workbook_version_id: "version-1",
  macro_context: JSON.stringify({ upstream: { phi2: 0.5 } }),
  sample: [{ phi2: 0.8 }],
};

describe("resolveMacroPreviewSource", () => {
  it("resolves the macro, workbook version, experiment and recorded ctx", () => {
    const result = resolveMacroPreviewSource(measurement(fullPayload));

    expect(result).toEqual({
      ok: true,
      source: {
        experimentId: EXPERIMENT_ID,
        workbookVersionId: "version-1",
        macroId: "macro-1",
        // The upload envelope is stripped: the macro re-sees the raw scan.
        rawMeasurement: { sample: [{ phi2: 0.8 }] },
        ctx: { upstream: { phi2: 0.5 } },
      },
    });
  });

  it("strips the injected macros routing list from sample entries", () => {
    const result = resolveMacroPreviewSource(
      measurement({
        ...fullPayload,
        sample: [
          { phi2: 0.8, macros: ["macro-1.js"] },
          { phi2: 0.2, macros: ["macro-1.js"] },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source.rawMeasurement.sample).toEqual([{ phi2: 0.8 }, { phi2: 0.2 }]);
  });

  it("keeps capture-time keys that coincide with envelope additions it cannot prove", () => {
    // timestamp/user_id may have been part of the raw measurement; stripping
    // them would be a worse fidelity break than leaving them.
    const result = resolveMacroPreviewSource(
      measurement({ ...fullPayload, timestamp: "2026-08-01T10:00:00Z", user_id: "u1" }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source.rawMeasurement.timestamp).toBe("2026-08-01T10:00:00Z");
    expect(result.source.rawMeasurement.user_id).toBe("u1");
  });

  it("recovers the producing workbook id and strips it from the replay input", () => {
    const result = resolveMacroPreviewSource(
      measurement({ ...fullPayload, workbook_id: "workbook-1" }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source.workbookId).toBe("workbook-1");
    expect(result.source.rawMeasurement.workbook_id).toBeUndefined();
  });

  it("leaves workbookId unset for payloads that predate the field", () => {
    const result = resolveMacroPreviewSource(measurement(fullPayload));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source.workbookId).toBeUndefined();
  });

  it("reports no-macro for a questions-only save", () => {
    const result = resolveMacroPreviewSource(
      measurement({ macros: null, workbook_version_id: "version-1" }),
    );
    expect(result).toEqual({ ok: false, blocker: "no-macro" });
  });

  it("reports no-workbook-version for payloads that predate the snapshot ref", () => {
    const result = resolveMacroPreviewSource(measurement({ macros: fullPayload.macros }));
    expect(result).toEqual({ ok: false, blocker: "no-workbook-version" });
  });

  it("reports unknown-experiment when the topic does not match the template", () => {
    const result = resolveMacroPreviewSource(measurement(fullPayload, "some/other/topic"));
    expect(result).toEqual({ ok: false, blocker: "unknown-experiment" });
  });

  it("reports decode-failed when a marked sample cannot be restored", () => {
    const corrupt = resolveMacroPreviewSource(
      measurement({ ...fullPayload, sample: "!!!not-base64!!!", _sample_encoding: "gzip+base64" }),
    );
    const mismatched = resolveMacroPreviewSource(
      measurement({ ...fullPayload, sample: [{ phi2: 0.8 }], _sample_encoding: "gzip+base64" }),
    );

    expect(corrupt).toEqual({ ok: false, blocker: "decode-failed" });
    expect(mismatched).toEqual({ ok: false, blocker: "decode-failed" });
  });

  it("falls back to an empty ctx when macro_context is absent or malformed", () => {
    const absent = resolveMacroPreviewSource(
      measurement({ ...fullPayload, macro_context: undefined }),
    );
    const malformed = resolveMacroPreviewSource(
      measurement({ ...fullPayload, macro_context: "{not json" }),
    );

    expect(absent.ok && absent.source.ctx).toEqual({});
    expect(malformed.ok && malformed.source.ctx).toEqual({});
  });

  it("restores the sample envelope so the macro receives what it did at capture time", () => {
    const compressed = {
      ...fullPayload,
      // gzip+base64 of [{"phi2":0.8},{"phi2":0.2}], as written at upload time.
      sample: "H4sIAAAAAAAAA4uuVirIyDRSsjLQs6jVQXCMamMBBSSYiBsAAAA=",
      _sample_encoding: "gzip+base64",
    };

    const result = resolveMacroPreviewSource(measurement(compressed));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source.rawMeasurement._sample_encoding).toBeUndefined();
    expect(result.source.rawMeasurement.sample).toEqual([{ phi2: 0.8 }, { phi2: 0.2 }]);
  });

  it("replays the capture-time input from the real stored shape (compressed + injected)", () => {
    const compressed = {
      ...fullPayload,
      // gzip+base64 of the sample entries after buildUploadPayload injected
      // `macros`: [{"phi2":0.8,"macros":["macro-1.js"]},{"phi2":0.2,"macros":["macro-1.js"]}]
      sample: "H4sIAAAAAAAAA4uuVirIyDRSsjLQs9BRyk1MLsovVrKKhrB0DfWyipVia3UQioxwKooFAF3o7nVLAAAA",
      _sample_encoding: "gzip+base64",
    };

    const result = resolveMacroPreviewSource(measurement(compressed));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Exactly the pre-injection capture input: no `macros` key on any entry.
    expect(result.source.rawMeasurement.sample).toEqual([{ phi2: 0.8 }, { phi2: 0.2 }]);
  });
});
