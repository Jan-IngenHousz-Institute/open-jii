import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockInvalidateQueries,
  mockMarkFailedUploadAsSuccessful,
  mockRemoveFailedUpload,
  mockSaveFailedUpload,
  mockUpdateFailedUpload,
  mockSendMqttEvent,
  mockPruneExpiredUploads,
  mockToastInfo,
} = vi.hoisted(() => ({
  mockInvalidateQueries: vi.fn().mockResolvedValue(undefined),
  mockMarkFailedUploadAsSuccessful: vi.fn(),
  mockRemoveFailedUpload: vi.fn(),
  mockSaveFailedUpload: vi.fn(),
  mockUpdateFailedUpload: vi.fn(),
  mockSendMqttEvent: vi.fn(),
  mockPruneExpiredUploads: vi.fn(),
  mockToastInfo: vi.fn(),
}));

// Mutable — each test sets this before calling useFailedUploads()
// so the hook's uploadAll/uploadOne callbacks close over the right data.
let mockUploads: { key: string; data: any }[] = [];

// Updated each time useFailedUploads() is called via the useAsyncCallback mock.
let capturedUploadAllCallback: () => Promise<any>;

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
  useQuery: () => ({ data: mockUploads }),
}));

vi.mock("~/services/failed-uploads-storage", () => ({
  getFailedUploadsWithKeys: vi.fn().mockResolvedValue([]),
  markFailedUploadAsSuccessful: mockMarkFailedUploadAsSuccessful,
  removeFailedUpload: mockRemoveFailedUpload,
  saveFailedUpload: mockSaveFailedUpload,
  updateFailedUpload: mockUpdateFailedUpload,
}));

vi.mock("~/services/mqtt/send-mqtt-event", () => ({
  sendMqttEvent: mockSendMqttEvent,
}));

vi.mock("~/services/successful-uploads-storage", () => ({
  pruneExpiredUploads: mockPruneExpiredUploads,
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

// Helper: seed uploads and mount the hook so callbacks close over the right data.
async function mountWithUploads(uploads: { key: string; data: any }[]) {
  mockUploads = uploads;
  const { useFailedUploads } = await import("../use-failed-uploads");
  return useFailedUploads();
}

describe("useFailedUploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUploads = [];
  });

  describe("uploadAll", () => {
    it("marks each upload as successful in-place (no duplicate insert)", async () => {
      await mountWithUploads([{ key: "upload-key-1", data: mockUpload }]);
      mockSendMqttEvent.mockResolvedValueOnce(undefined);

      await capturedUploadAllCallback();

      expect(mockSendMqttEvent).toHaveBeenCalledWith(mockUpload.topic, mockUpload.measurementResult);
      expect(mockMarkFailedUploadAsSuccessful).toHaveBeenCalledWith("upload-key-1");
    });

    it("does not call removeFailedUpload", async () => {
      await mountWithUploads([{ key: "upload-key-1", data: mockUpload }]);
      mockSendMqttEvent.mockResolvedValueOnce(undefined);

      await capturedUploadAllCallback();

      expect(mockRemoveFailedUpload).not.toHaveBeenCalled();
    });

    it("prunes expired uploads after uploading", async () => {
      await mountWithUploads([{ key: "upload-key-1", data: mockUpload }]);
      mockSendMqttEvent.mockResolvedValueOnce(undefined);

      await capturedUploadAllCallback();

      expect(mockPruneExpiredUploads).toHaveBeenCalledOnce();
    });

    it("invalidates failedUploads and allMeasurements queries", async () => {
      await mountWithUploads([{ key: "upload-key-1", data: mockUpload }]);
      mockSendMqttEvent.mockResolvedValueOnce(undefined);

      await capturedUploadAllCallback();

      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["failedUploads"] });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["allMeasurements"] });
    });

    it("prunes and invalidates even when a send fails", async () => {
      await mountWithUploads([{ key: "upload-key-1", data: mockUpload }]);
      mockSendMqttEvent.mockRejectedValueOnce(new Error("network error"));
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());

      await expect(capturedUploadAllCallback()).rejects.toThrow("network error");

      expect(mockPruneExpiredUploads).toHaveBeenCalledOnce();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["allMeasurements"] });

      consoleSpy.mockRestore();
    });

    it("marks multiple uploads in one pass", async () => {
      await mountWithUploads([
        { key: "key-1", data: mockUpload },
        { key: "key-2", data: { ...mockUpload, topic: "test/topic2" } },
      ]);
      mockSendMqttEvent.mockResolvedValue(undefined);

      await capturedUploadAllCallback();

      expect(mockMarkFailedUploadAsSuccessful).toHaveBeenCalledWith("key-1");
      expect(mockMarkFailedUploadAsSuccessful).toHaveBeenCalledWith("key-2");
      expect(mockMarkFailedUploadAsSuccessful).toHaveBeenCalledTimes(2);
    });
  });

  describe("uploadOne", () => {
    it("marks the matching upload as successful", async () => {
      const { uploadOne } = await mountWithUploads([{ key: "upload-key-1", data: mockUpload }]);
      mockSendMqttEvent.mockResolvedValueOnce(undefined);

      await uploadOne("upload-key-1");

      expect(mockMarkFailedUploadAsSuccessful).toHaveBeenCalledWith("upload-key-1");
      expect(mockRemoveFailedUpload).not.toHaveBeenCalled();
    });

    it("prunes expired uploads after a single upload", async () => {
      const { uploadOne } = await mountWithUploads([{ key: "upload-key-1", data: mockUpload }]);
      mockSendMqttEvent.mockResolvedValueOnce(undefined);

      await uploadOne("upload-key-1");

      expect(mockPruneExpiredUploads).toHaveBeenCalledOnce();
    });

    it("invalidates failedUploads and allMeasurements after upload", async () => {
      const { uploadOne } = await mountWithUploads([{ key: "upload-key-1", data: mockUpload }]);
      mockSendMqttEvent.mockResolvedValueOnce(undefined);

      await uploadOne("upload-key-1");

      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["failedUploads"] });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["allMeasurements"] });
    });

    it("shows toast, skips mark, and still prunes when MQTT send fails", async () => {
      const { uploadOne } = await mountWithUploads([{ key: "upload-key-1", data: mockUpload }]);
      mockSendMqttEvent.mockRejectedValueOnce(new Error("timeout"));
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());

      await uploadOne("upload-key-1");

      expect(mockMarkFailedUploadAsSuccessful).not.toHaveBeenCalled();
      expect(mockToastInfo).toHaveBeenCalledWith("Failed to upload, try again later");
      expect(mockPruneExpiredUploads).toHaveBeenCalledOnce();

      consoleSpy.mockRestore();
    });

    it("does nothing when key is not found in uploads list", async () => {
      const { uploadOne } = await mountWithUploads([]);

      await uploadOne("non-existent-key");

      expect(mockSendMqttEvent).not.toHaveBeenCalled();
      expect(mockMarkFailedUploadAsSuccessful).not.toHaveBeenCalled();
      expect(mockPruneExpiredUploads).not.toHaveBeenCalled();
    });
  });
});
