import { describe, expect, it, vi } from "vitest";
import type { StoredMeasurement } from "~/shared/db/measurements-storage";

import { resolveMacroPreviewSource } from "./resolve-macro-preview-source";

vi.mock("~/shared/stores/environment-store", () => ({
  getEnvVar: (key: string) =>
    key === "MQTT_TOPIC"
      ? "experiment/data_ingest/v1/:experimentId/multispeq/v1.0/:clientId/:protocolId"
      : "client-1",
}));

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
  it("resolves the macro, workbook version, experiment, payload and recorded ctx", () => {
    const result = resolveMacroPreviewSource(measurement(fullPayload));

    expect(result).toEqual({
      ok: true,
      source: {
        experimentId: EXPERIMENT_ID,
        workbookVersionId: "version-1",
        macroId: "macro-1",
        rawMeasurement: fullPayload,
        ctx: { upstream: { phi2: 0.5 } },
      },
    });
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
});
