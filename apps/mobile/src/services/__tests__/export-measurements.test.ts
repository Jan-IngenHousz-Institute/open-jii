import * as Sharing from "expo-sharing";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { exportMeasurementsToFile, exportSingleMeasurementToFile } from "../export-measurements";
import { getMeasurements } from "~/services/measurements-storage";

const mockCreate = vi.fn();
const mockWrite = vi.fn();

vi.mock("expo-file-system", () => {
  const MockFile = vi.fn(function (this: any) {
    this.create = mockCreate;
    this.write = mockWrite;
    this.uri = "file:///cache/test-file.json";
  });
  return { File: MockFile, Paths: { cache: "/cache" } };
});

vi.mock("expo-sharing", () => ({
  shareAsync: vi.fn(),
}));

vi.mock("~/services/measurements-storage", () => ({
  getMeasurements: vi.fn().mockResolvedValue([]),
}));

const mockGetMeasurements = vi.mocked(getMeasurements);

const mockStoredMeasurement = (overrides?: Partial<{ experimentName: string; timestamp: string }>) => ({
  topic: "test/topic",
  measurementResult: { value: 42 },
  metadata: {
    experimentName: overrides?.experimentName ?? "Test Experiment",
    protocolName: "protocol-1",
    timestamp: overrides?.timestamp ?? "2026-03-02T10:00:00.000Z",
  },
});

describe("exportMeasurementsToFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMeasurements.mockResolvedValue([]);
  });

  it("creates and writes a file with correct counts", async () => {
    mockGetMeasurements
      .mockResolvedValueOnce([["failed-1", mockStoredMeasurement()]])
      .mockResolvedValueOnce([["synced-1", mockStoredMeasurement()]]);

    await exportMeasurementsToFile();

    const writtenData = JSON.parse(mockWrite.mock.calls[0][0]);
    expect(writtenData.totalCount).toBe(2);
    expect(writtenData.unsyncedCount).toBe(1);
    expect(writtenData.syncedCount).toBe(1);
  });

  it("marks failed entries as unsynced and successful as synced", async () => {
    mockGetMeasurements
      .mockResolvedValueOnce([["failed-1", mockStoredMeasurement({ experimentName: "Exp A" })]])
      .mockResolvedValueOnce([["synced-1", mockStoredMeasurement({ experimentName: "Exp B" })]]);

    await exportMeasurementsToFile();

    const writtenData = JSON.parse(mockWrite.mock.calls[0][0]);
    const unsynced = writtenData.measurements.find((m: { status: string }) => m.status === "unsynced");
    const synced = writtenData.measurements.find((m: { status: string }) => m.status === "synced");

    expect(unsynced.experimentName).toBe("Exp A");
    expect(synced.experimentName).toBe("Exp B");
  });

  it("sorts measurements newest first", async () => {
    mockGetMeasurements
      .mockResolvedValueOnce([
        ["old", mockStoredMeasurement({ timestamp: "2026-01-01T00:00:00.000Z" })],
        ["new", mockStoredMeasurement({ timestamp: "2026-03-01T00:00:00.000Z" })],
      ])
      .mockResolvedValueOnce([]);

    await exportMeasurementsToFile();

    const writtenData = JSON.parse(mockWrite.mock.calls[0][0]);
    expect(writtenData.measurements[0].timestamp).toBe("2026-03-01T00:00:00.000Z");
    expect(writtenData.measurements[1].timestamp).toBe("2026-01-01T00:00:00.000Z");
  });

  it("opens the native share dialog with correct options", async () => {
    await exportMeasurementsToFile();

    expect(Sharing.shareAsync).toHaveBeenCalledWith("file:///cache/test-file.json", {
      mimeType: "application/json",
      dialogTitle: "Export Measurements",
    });
  });

  it("uses an export filename pattern", async () => {
    const { File } = await import("expo-file-system");

    await exportMeasurementsToFile();

    const constructorCall = vi.mocked(File).mock.calls[vi.mocked(File).mock.calls.length - 1];
    expect(constructorCall[1]).toMatch(/^measurements-export-/);
  });

  it("handles empty storage without throwing", async () => {
    await expect(exportMeasurementsToFile()).resolves.toBeUndefined();

    const writtenData = JSON.parse(mockWrite.mock.calls[0][0]);
    expect(writtenData.totalCount).toBe(0);
    expect(writtenData.measurements).toHaveLength(0);
  });
});

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
