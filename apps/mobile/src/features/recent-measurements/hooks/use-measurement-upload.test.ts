import { describe, expect, it, vi } from "vitest";
import type { AnswerData } from "~/shared/measurements/convert-cycle-answers-to-array";

import { prepareMeasurementForUpload } from "./use-measurement-upload";

// The module pulls UI/transport deps that don't run under vitest — stub
// everything prepareMeasurementForUpload itself doesn't use.
vi.mock("sonner-native", () => ({ toast: { error: vi.fn() } }));
vi.mock("~/shared/ui/AlertDialog", () => ({ showAlert: vi.fn() }));
vi.mock("~/shared/composition/upload", () => ({ getOutbox: vi.fn() }));
vi.mock("~/features/recent-measurements/services/export-measurements", () => ({
  exportSingleMeasurementToFile: vi.fn(),
}));
vi.mock("~/features/recent-measurements/hooks/use-measurements", () => ({
  useMeasurements: vi.fn(),
}));
vi.mock("~/shared/i18n", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock("~/features/connection/utils/get-multispeq-mqtt-topic", () => ({
  getMultispeqMqttTopic: vi.fn(() => "topic"),
}));

const baseArgs = {
  userId: "user-1",
  macro: { id: "m-1", name: "Macro", filename: "macro.js" },
  timestamp: "2026-06-11T10:00:00.000Z",
  timezone: "Europe/Amsterdam",
  questions: [] as AnswerData[],
};

describe("prepareMeasurementForUpload", () => {
  it("adds bundle correlation fields when bundle info is given", () => {
    const payload = prepareMeasurementForUpload({
      ...baseArgs,
      rawMeasurement: { device_id: "MSPx-0001", sample: [{ data_raw: [1, 2] }] },
      bundle: { bundle_id: "b-1", bundle_size: 4, device_index: 2 },
    });

    expect(payload.bundle_id).toBe("b-1");
    expect(payload.bundle_size).toBe(4);
    expect(payload.device_index).toBe(2);
    // Sample compression stays intact alongside the bundle fields.
    expect(payload._sample_encoding).toBe("gzip+base64");
    expect(typeof payload.sample).toBe("string");
  });

  it("omits bundle fields when no bundle info is given", () => {
    const payload = prepareMeasurementForUpload({
      ...baseArgs,
      rawMeasurement: { device_id: "MSPx-0001" },
    });

    expect(payload).not.toHaveProperty("bundle_id");
    expect(payload).not.toHaveProperty("bundle_size");
    expect(payload).not.toHaveProperty("device_index");
  });

  it("falls back to the local device id only when the firmware did not supply one", () => {
    const withFirmwareId = prepareMeasurementForUpload({
      ...baseArgs,
      rawMeasurement: { device_id: "MSPx-0001" },
      fallbackDeviceId: "42",
    });
    expect(withFirmwareId.device_id).toBe("MSPx-0001");

    const withoutFirmwareId = prepareMeasurementForUpload({
      ...baseArgs,
      rawMeasurement: {},
      fallbackDeviceId: "42",
    });
    expect(withoutFirmwareId.device_id).toBe("42");

    const withNeither = prepareMeasurementForUpload({
      ...baseArgs,
      rawMeasurement: {},
    });
    expect(withNeither).not.toHaveProperty("device_id");
  });
});
