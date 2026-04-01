import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockInvalidateQueries,
  mockMarkAsSuccessful,
  mockRemoveMeasurement,
  mockSaveMeasurement,
  mockUpdateMeasurement,
  mockSendMqttEvent,
  mockPruneExpiredMeasurements,
  mockToastInfo,
} = vi.hoisted(() => ({
  mockInvalidateQueries: vi.fn().mockResolvedValue(undefined),
  mockMarkAsSuccessful: vi.fn(),
  mockRemoveMeasurement: vi.fn(),
  mockSaveMeasurement: vi.fn(),
  mockUpdateMeasurement: vi.fn(),
  mockSendMqttEvent: vi.fn(),
  mockPruneExpiredMeasurements: vi.fn(),
  mockToastInfo: vi.fn(),
}));

let mockFailedUploads: { key: string; data: any }[] = [];
let capturedUploadAllCallback: () => Promise<any>;

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
  useQuery: () => ({ data: mockFailedUploads }),
}));

vi.mock("~/services/measurements-storage", () => ({
  getMeasurements: vi.fn().mockResolvedValue([]),
  markAsSuccessful: mockMarkAsSuccessful,
  removeMeasurement: mockRemoveMeasurement,
  saveMeasurement: mockSaveMeasurement,
  updateMeasurement: mockUpdateMeasurement,
  pruneExpiredMeasurements: mockPruneExpiredMeasurements,
}));

vi.mock("~/services/mqtt/send-mqtt-event", () => ({
  sendMqttEvent: mockSendMqttEvent,
}));

vi.mock("sonner-native", () => ({
  toast: { info: mockToastInfo },
}));

vi.mock("react-async-hook", () => ({
  useAsyncCallback: (fn: () => Promise<any>) => {
    capturedUploadAllCallback = fn;
    return { loading: false, execute: fn };
  },
}));

const mockUpload = {
  topic: "test/topic",
  measurementResult: { value: 42 },
  metadata: {
    experimentName: "Test Experiment",
    protocolName: "protocol-1",
    timestamp: "2026-03-02T10:00:00.000Z",
  },
};

async function mountWithUploads(uploads: { key: string; data: any }[]) {
  mockFailedUploads = uploads;
  const { useMeasurements } = await import("../use-measurements");
  return useMeasurements();
}

describe("useMeasurements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFailedUploads = [];
  });

  // ---------------------------------------------------------------------------
  // uploadAll
  // ---------------------------------------------------------------------------

  describe("uploadAll", () => {
    it("marks each upload as successful in-place", async () => {
      await mountWithUploads([{ key: "upload-key-1", data: mockUpload }]);
      mockSendMqttEvent.mockResolvedValueOnce(undefined);

      await capturedUploadAllCallback();

      expect(mockSendMqttEvent).toHaveBeenCalledWith(
        mockUpload.topic,
        mockUpload.measurementResult,
      );
      expect(mockMarkAsSuccessful).toHaveBeenCalledWith("upload-key-1");
    });

    it("does not call removeMeasurement", async () => {
      await mountWithUploads([{ key: "upload-key-1", data: mockUpload }]);
      mockSendMqttEvent.mockResolvedValueOnce(undefined);

      await capturedUploadAllCallback();

      expect(mockRemoveMeasurement).not.toHaveBeenCalled();
    });

    it("prunes expired uploads after uploading", async () => {
      await mountWithUploads([{ key: "upload-key-1", data: mockUpload }]);
      mockSendMqttEvent.mockResolvedValueOnce(undefined);

      await capturedUploadAllCallback();

      expect(mockPruneExpiredMeasurements).toHaveBeenCalledOnce();
    });

    it("invalidates failedUploads and allMeasurements queries", async () => {
      await mountWithUploads([{ key: "upload-key-1", data: mockUpload }]);
      mockSendMqttEvent.mockResolvedValueOnce(undefined);

      await capturedUploadAllCallback();

      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["measurements"] });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["measurements"] });
    });

    it("prunes and invalidates even when a send fails", async () => {
      await mountWithUploads([{ key: "upload-key-1", data: mockUpload }]);
      mockSendMqttEvent.mockRejectedValueOnce(new Error("network error"));
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());

      await expect(capturedUploadAllCallback()).rejects.toThrow("network error");

      expect(mockPruneExpiredMeasurements).toHaveBeenCalledOnce();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["measurements"] });

      consoleSpy.mockRestore();
    });

    it("marks multiple uploads in one pass", async () => {
      await mountWithUploads([
        { key: "key-1", data: mockUpload },
        { key: "key-2", data: { ...mockUpload, topic: "test/topic2" } },
      ]);
      mockSendMqttEvent.mockResolvedValue(undefined);

      await capturedUploadAllCallback();

      expect(mockMarkAsSuccessful).toHaveBeenCalledWith("key-1");
      expect(mockMarkAsSuccessful).toHaveBeenCalledWith("key-2");
      expect(mockMarkAsSuccessful).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------------------
  // uploadOne
  // ---------------------------------------------------------------------------

  describe("uploadOne", () => {
    it("marks the matching upload as successful", async () => {
      const { uploadOne } = await mountWithUploads([{ key: "upload-key-1", data: mockUpload }]);
      mockSendMqttEvent.mockResolvedValueOnce(undefined);

      await uploadOne("upload-key-1");

      expect(mockMarkAsSuccessful).toHaveBeenCalledWith("upload-key-1");
      expect(mockRemoveMeasurement).not.toHaveBeenCalled();
    });

    it("prunes after a single upload", async () => {
      const { uploadOne } = await mountWithUploads([{ key: "upload-key-1", data: mockUpload }]);
      mockSendMqttEvent.mockResolvedValueOnce(undefined);

      await uploadOne("upload-key-1");

      expect(mockPruneExpiredMeasurements).toHaveBeenCalledOnce();
    });

    it("invalidates failedUploads and allMeasurements after upload", async () => {
      const { uploadOne } = await mountWithUploads([{ key: "upload-key-1", data: mockUpload }]);
      mockSendMqttEvent.mockResolvedValueOnce(undefined);

      await uploadOne("upload-key-1");

      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["measurements"] });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["measurements"] });
    });

    it("shows toast, skips mark, and still prunes when MQTT send fails", async () => {
      const { uploadOne } = await mountWithUploads([{ key: "upload-key-1", data: mockUpload }]);
      mockSendMqttEvent.mockRejectedValueOnce(new Error("timeout"));
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());

      await uploadOne("upload-key-1");

      expect(mockMarkAsSuccessful).not.toHaveBeenCalled();
      expect(mockToastInfo).toHaveBeenCalledWith("Failed to upload, try again later");
      expect(mockPruneExpiredMeasurements).toHaveBeenCalledOnce();

      consoleSpy.mockRestore();
    });

    it("does nothing when key is not found", async () => {
      const { uploadOne } = await mountWithUploads([]);

      await uploadOne("non-existent-key");

      expect(mockSendMqttEvent).not.toHaveBeenCalled();
      expect(mockMarkAsSuccessful).not.toHaveBeenCalled();
      expect(mockPruneExpiredMeasurements).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // saveMeasurement
  // ---------------------------------------------------------------------------

  describe("saveMeasurement", () => {
    it("saves as failed and invalidates failedUploads + allMeasurements", async () => {
      const { saveMeasurement } = await mountWithUploads([]);

      await saveMeasurement(mockUpload, "failed");

      expect(mockSaveMeasurement).toHaveBeenCalledWith(mockUpload, "failed");
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["measurements"] });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["measurements"] });
    });

    it("saves as successful and invalidates measurements", async () => {
      const { saveMeasurement } = await mountWithUploads([]);

      await saveMeasurement(mockUpload, "successful");

      expect(mockSaveMeasurement).toHaveBeenCalledWith(mockUpload, "successful");
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["measurements"] });
    });
  });

  // ---------------------------------------------------------------------------
  // removeMeasurement
  // ---------------------------------------------------------------------------

  describe("removeMeasurement", () => {
    it("removes a failed measurement and invalidates measurements", async () => {
      const { removeMeasurement } = await mountWithUploads([]);

      removeMeasurement("key-1", "failed");

      expect(mockRemoveMeasurement).toHaveBeenCalledWith("key-1", "failed");
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["measurements"] });
    });

    it("removes a successful measurement and invalidates measurements", async () => {
      const { removeMeasurement } = await mountWithUploads([]);

      removeMeasurement("key-1", "successful");

      expect(mockRemoveMeasurement).toHaveBeenCalledWith("key-1", "successful");
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["measurements"] });
    });
  });
});
