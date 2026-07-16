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
vi.mock("~/shared/measurements/measurement-topic", () => ({
  getMultispeqMqttTopic: ({
    experimentId,
    protocolId,
  }: {
    experimentId: string;
    protocolId: string;
  }) => `topic/${experimentId}/${protocolId}`,
}));
vi.mock("~/features/recent-measurements/services/export-measurements", () => ({
  exportSingleMeasurementToFile: vi.fn(),
}));
vi.mock("~/shared/ui/AlertDialog", () => ({ showAlert: vi.fn() }));
vi.mock("sonner-native", () => ({ toast: { error: vi.fn() } }));
vi.mock("~/shared/i18n", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

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
};

type SavedCall = [
  {
    topic: string;
    measurementResult: { workbook_run_id?: string };
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
        results: [
          {
            rawMeasurement: { a: 1 },
            device: { id: "d1", name: "A" },
            protocolId: "proto-a",
            protocolName: "Proto A",
          },
          {
            rawMeasurement: { b: 2 },
            device: { id: "d2", name: "B" },
            protocolId: "proto-b",
            protocolName: "Proto B",
          },
          // No per-result protocol: falls back to the batch-level one.
          { rawMeasurement: { c: 3 }, device: { id: "d3", name: "C" } },
        ],
      });
    });

    const calls = saveMeasurement.mock.calls as SavedCall[];
    expect(calls.map(([m]) => m.topic)).toEqual([
      "topic/exp-1/proto-a",
      "topic/exp-1/proto-b",
      "topic/exp-1/proto-shared",
    ]);
    expect(calls.map(([m]) => m.metadata.protocolName)).toEqual(["Proto A", "Proto B", "Shared"]);

    const runIds = calls.map(([m]) => m.measurementResult.workbook_run_id);
    expect(runIds[0]).toBeTruthy();
    expect(new Set(runIds).size).toBe(1);

    expect(enqueueMany).toHaveBeenCalledWith(["saved-1", "saved-2", "saved-3"]);
  });

  it("omits workbook_run_id for a single-device round", async () => {
    const { result } = renderHook(() => useMeasurementUpload(), { wrapper });

    await act(async () => {
      await result.current.uploadMeasurements({
        ...SHARED,
        results: [{ rawMeasurement: { a: 1 }, device: { id: "d1", name: "A" } }],
      });
    });

    const [measurement] = saveMeasurement.mock.calls[0] as SavedCall;
    expect(measurement.topic).toBe("topic/exp-1/proto-shared");
    expect(measurement.measurementResult).not.toHaveProperty("workbook_run_id");
  });
});
