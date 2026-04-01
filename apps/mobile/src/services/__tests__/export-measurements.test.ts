import * as Sharing from "expo-sharing";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { exportSingleMeasurementToFile } from "../export-measurements";

const mockCreate = vi.fn();
const mockWrite = vi.fn();

vi.mock("expo-file-system", () => ({
  File: vi.fn().mockImplementation(() => ({
    create: mockCreate,
    write: mockWrite,
    uri: "file:///cache/test-file.json",
  })),
  Paths: { cache: "/cache" },
}));

vi.mock("expo-sharing", () => ({
  shareAsync: vi.fn(),
}));

vi.mock("~/services/measurements-storage", () => ({
  getMeasurements: vi.fn().mockResolvedValue([]),
}));

const mockMeasurement = {
  topic: "test/topic",
  measurementResult: { value: 42 },
  metadata: {
    experimentName: "Test Experiment",
    protocolName: "protocol-1",
    timestamp: "2026-03-02T10:00:00.000Z",
  },
};

describe("exportSingleMeasurementToFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a file with the measurement data", async () => {
    await exportSingleMeasurementToFile(mockMeasurement);

    expect(mockCreate).toHaveBeenCalled();
    expect(mockWrite).toHaveBeenCalled();

    const writtenData = JSON.parse(mockWrite.mock.calls[0][0]);
    expect(writtenData.totalCount).toBe(1);
    expect(writtenData.unsyncedCount).toBe(1);
    expect(writtenData.syncedCount).toBe(0);
    expect(writtenData.measurements).toHaveLength(1);
    expect(writtenData.measurements[0].status).toBe("unsynced");
    expect(writtenData.measurements[0].data).toEqual(mockMeasurement);
  });

  it("opens the native share dialog with correct options", async () => {
    await exportSingleMeasurementToFile(mockMeasurement);

    expect(Sharing.shareAsync).toHaveBeenCalledWith("file:///cache/test-file.json", {
      mimeType: "application/json",
      dialogTitle: "Save Measurement",
    });
  });

  it("uses a rescue filename pattern", async () => {
    const { File } = await import("expo-file-system");

    await exportSingleMeasurementToFile(mockMeasurement);

    const constructorCall = vi.mocked(File).mock.calls[vi.mocked(File).mock.calls.length - 1];
    expect(constructorCall[1]).toMatch(/^measurement-rescue-/);
  });
});
