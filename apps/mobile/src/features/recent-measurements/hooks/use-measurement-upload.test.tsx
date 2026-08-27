// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMeasurementUpload } from "./use-measurement-upload";

const { saveMeasurement, enqueueMany } = vi.hoisted(() => ({
  saveMeasurement: vi.fn(),
  enqueueMany: vi.fn(),
}));

vi.mock("~/features/recent-measurements/hooks/use-measurements", () => ({
  useMeasurements: () => ({ saveMeasurement }),
}));
vi.mock("~/shared/composition/upload", () => ({
  getOutbox: () => ({ enqueueMany }),
}));
// Keeps the environment store out; the template shape is all that matters.
vi.mock("~/shared/stores/device-identity-store", () => ({
  whenDeviceIdentityLoaded: () => Promise.resolve(),
}));
vi.mock("~/shared/measurements/measurement-topic", () => ({
  getMeasurementMqttTopic: ({ experimentId }: { experimentId: string }) => `topic/${experimentId}`,
}));
vi.mock("~/features/recent-measurements/services/export-measurements", () => ({
  exportSingleMeasurementToFile: vi.fn(),
}));
vi.mock("~/shared/ui/AlertDialog", () => ({ showAlert: vi.fn() }));
vi.mock("sonner-native", () => ({ toast: { error: vi.fn() } }));
vi.mock("~/shared/i18n", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
// Keeps expo-location (and expo internals that need __DEV__) out of jsdom.
vi.mock("~/shared/location/measurement-location", () => ({
  getMeasurementLocation: vi.fn(() => Promise.resolve(null)),
}));

const SHARED = {
  timestamp: "2026-04-20T10:00:00.000Z",
  timezone: "Europe/Amsterdam",
  experimentName: "Trial",
  experimentId: "exp-1",
  protocolId: "proto-shared",
  protocolName: "Shared",
  userId: "user-1",
  macro: null,
  questions: [],
  workbookRunId: "run-attempt-1",
  workbookVersionId: "version-1",
};

type SavedCall = [
  {
    topic: string;
    measurementResult: {
      workbook_run_id?: string;
      protocol_id?: string;
      workbook_version_id?: string;
      macro_context?: string;
      device_firmware?: string;
    };
    metadata: { protocolName: string };
  },
  string,
];

describe("useMeasurementUpload", () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    client = new QueryClient();
    vi.clearAllMocks();
    let n = 0;
    saveMeasurement.mockImplementation(() => Promise.resolve(`saved-${++n}`));
  });

  it("publishes each result on ITS protocol topic while sharing one workbook_run_id", async () => {
    const { result } = renderHook(() => useMeasurementUpload(), { wrapper });

    await act(async () => {
      await result.current.uploadMeasurements({
        ...SHARED,
        workbookVersionId: "version-1",
        results: [
          {
            rawMeasurement: { a: 1 },
            device: { id: "d1", name: "A", firmwareVersion: "2.311" },
            protocolId: "proto-a",
            protocolName: "Proto A",
            macroContext: { measurement: { a: 1 } },
          },
          {
            rawMeasurement: { b: 2 },
            device: { id: "d2", name: "B", firmwareVersion: "1.04" },
            protocolId: "proto-b",
            protocolName: "Proto B",
          },
          // No per-result protocol: falls back to the batch-level one.
          { rawMeasurement: { c: 3 }, device: { id: "d3", name: "C" } },
        ],
      });
    });

    const calls = saveMeasurement.mock.calls as SavedCall[];
    // One lean topic per experiment; per-result attribution rides the payload.
    expect(calls.map(([m]) => m.topic)).toEqual(["topic/exp-1", "topic/exp-1", "topic/exp-1"]);
    expect(calls.map(([m]) => m.measurementResult.protocol_id)).toEqual([
      "proto-a",
      "proto-b",
      "proto-shared",
    ]);
    expect(calls.map(([m]) => m.metadata.protocolName)).toEqual(["Proto A", "Proto B", "Shared"]);
    expect(calls.map(([m]) => m.measurementResult.device_firmware)).toEqual([
      "2.311",
      "1.04",
      undefined,
    ]);

    const runIds = calls.map(([m]) => m.measurementResult.workbook_run_id);
    expect(runIds).toEqual(["run-attempt-1", "run-attempt-1", "run-attempt-1"]);
    expect(calls[0][0].measurementResult).toMatchObject({
      workbook_version_id: "version-1",
      macro_context: JSON.stringify({ measurement: { a: 1 } }),
    });

    expect(enqueueMany).toHaveBeenCalledWith(["saved-1", "saved-2", "saved-3"]);
  });

  it("stamps the attempt workbook_run_id for a single-device round", async () => {
    const { result } = renderHook(() => useMeasurementUpload(), { wrapper });

    await act(async () => {
      await result.current.uploadMeasurements({
        ...SHARED,
        results: [{ rawMeasurement: { a: 1 }, device: { id: "d1", name: "A" } }],
      });
    });

    const [measurement] = saveMeasurement.mock.calls[0] as SavedCall;
    expect(measurement.topic).toBe("topic/exp-1");
    expect(measurement.measurementResult).toMatchObject({ protocol_id: "proto-shared" });
    expect(measurement.measurementResult.workbook_run_id).toBe("run-attempt-1");
  });
});
