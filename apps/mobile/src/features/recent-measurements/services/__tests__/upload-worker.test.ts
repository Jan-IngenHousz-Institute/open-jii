import { describe, it, expect, vi, beforeEach } from "vitest";
import { MqttError } from "~/features/connection/services/mqtt/mqtt-errors";

import { uploadWorker } from "../upload-worker";

const { mockGetMeasurementById, mockMarkAsSuccessful, mockMarkAsFailed, mockPublish } = vi.hoisted(
  () => ({
    mockGetMeasurementById: vi.fn(),
    mockMarkAsSuccessful: vi.fn(),
    mockMarkAsFailed: vi.fn(),
    mockPublish: vi.fn(),
  }),
);

vi.mock("~/shared/db/measurements-storage", () => ({
  getMeasurementById: mockGetMeasurementById,
  markAsSuccessful: mockMarkAsSuccessful,
  markAsFailed: mockMarkAsFailed,
}));

vi.mock("~/features/connection/services/mqtt/mqtt-publisher", () => ({
  getPublisher: () => ({ publish: mockPublish }),
}));

describe("uploadWorker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes the row payload and marks the row successful on success", async () => {
    mockGetMeasurementById.mockResolvedValueOnce({
      id: "row-1",
      status: "pending",
      data: {
        topic: "topic/a",
        measurementResult: { reading: 42 },
        metadata: { experimentName: "E", protocolName: "P", timestamp: "T" },
      },
    });
    mockPublish.mockResolvedValueOnce(undefined);

    await uploadWorker("row-1");

    expect(mockPublish).toHaveBeenCalledWith("topic/a", { reading: 42, _client_id: "row-1" });
    expect(mockMarkAsSuccessful).toHaveBeenCalledWith("row-1");
    expect(mockMarkAsFailed).not.toHaveBeenCalled();
  });

  it("returns early when the row is already successful", async () => {
    mockGetMeasurementById.mockResolvedValueOnce({
      id: "row-1",
      status: "successful",
      data: { topic: "topic/a", measurementResult: {}, metadata: {} },
    });

    await uploadWorker("row-1");

    expect(mockPublish).not.toHaveBeenCalled();
    expect(mockMarkAsSuccessful).not.toHaveBeenCalled();
  });

  it("returns early when the row no longer exists", async () => {
    mockGetMeasurementById.mockResolvedValueOnce(null);

    await uploadWorker("row-1");

    expect(mockPublish).not.toHaveBeenCalled();
  });

  it("throws on retryable MqttError so the AsyncRetryer can reschedule", async () => {
    mockGetMeasurementById.mockResolvedValueOnce({
      id: "row-1",
      status: "pending",
      data: { topic: "topic/a", measurementResult: {}, metadata: {} },
    });
    mockPublish.mockRejectedValueOnce(new MqttError("Timeout", "broker took too long"));

    await expect(uploadWorker("row-1")).rejects.toMatchObject({ kind: "Timeout" });
    expect(mockMarkAsFailed).not.toHaveBeenCalled();
  });

  it("marks the row failed on non-retryable MqttError", async () => {
    mockGetMeasurementById.mockResolvedValueOnce({
      id: "row-1",
      status: "pending",
      data: { topic: "topic/a", measurementResult: {}, metadata: {} },
    });
    mockPublish.mockRejectedValueOnce(new MqttError("Disconnected", "ran out of reconnects"));

    await uploadWorker("row-1");

    expect(mockMarkAsFailed).toHaveBeenCalledWith("row-1");
    expect(mockMarkAsSuccessful).not.toHaveBeenCalled();
  });

  it("embeds the row UUID in the published payload for downstream dedup", async () => {
    mockGetMeasurementById.mockResolvedValueOnce({
      id: "uuid-xyz",
      status: "pending",
      data: {
        topic: "topic/a",
        measurementResult: { sample: "data", _client_id: "should-be-overwritten" },
        metadata: {},
      },
    });
    mockPublish.mockResolvedValueOnce(undefined);

    await uploadWorker("uuid-xyz");

    const [, payload] = mockPublish.mock.calls[0]!;
    expect(payload._client_id).toBe("uuid-xyz");
  });
});
