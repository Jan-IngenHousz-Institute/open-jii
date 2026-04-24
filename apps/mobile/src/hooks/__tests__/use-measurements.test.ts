// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const {
  mockMarkAsSuccessful,
  mockMarkAsUploading,
  mockMarkAsFailed,
  mockRemoveMeasurement,
  mockSaveMeasurement,
  mockUpdateMeasurement,
  mockClearMeasurements,
  mockSendMqttEvent,
  mockPruneExpiredMeasurements,
  mockToastInfo,
} = vi.hoisted(() => ({
  mockMarkAsSuccessful: vi.fn().mockResolvedValue(undefined),
  mockMarkAsUploading: vi.fn().mockResolvedValue(undefined),
  mockMarkAsFailed: vi.fn().mockResolvedValue(undefined),
  mockRemoveMeasurement: vi.fn().mockResolvedValue(undefined),
  mockSaveMeasurement: vi.fn().mockResolvedValue(undefined),
  mockUpdateMeasurement: vi.fn().mockResolvedValue(undefined),
  mockClearMeasurements: vi.fn().mockResolvedValue(undefined),
  mockSendMqttEvent: vi.fn(),
  mockPruneExpiredMeasurements: vi.fn().mockResolvedValue(undefined),
  mockToastInfo: vi.fn(),
}));

vi.mock("~/services/measurements-storage", () => ({
  getMeasurements: vi.fn().mockResolvedValue([]),
  markAsSuccessful: mockMarkAsSuccessful,
  markAsUploading: mockMarkAsUploading,
  markAsFailed: mockMarkAsFailed,
  removeMeasurement: mockRemoveMeasurement,
  saveMeasurement: mockSaveMeasurement,
  updateMeasurement: mockUpdateMeasurement,
  clearMeasurements: mockClearMeasurements,
  pruneExpiredMeasurements: mockPruneExpiredMeasurements,
}));

vi.mock("~/utils/measurement-annotations", () => ({
  buildAnnotationsWithComment: (text: string) => ({ comment: text }),
}));

vi.mock("~/services/mqtt/send-mqtt-event", () => ({
  sendMqttEvent: mockSendMqttEvent,
}));

vi.mock("sonner-native", () => ({
  toast: { info: mockToastInfo },
}));

import { useMeasurements } from "../use-measurements";
import { getMeasurements } from "~/services/measurements-storage";

const mockMeasurement = {
  topic: "test/topic",
  measurementResult: { value: 42 },
  metadata: {
    experimentName: "Test Experiment",
    protocolName: "protocol-1",
    timestamp: "2026-03-02T10:00:00.000Z",
  },
};

let queryClient: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function renderMeasurements(failedUploads: { key: string; data: typeof mockMeasurement }[] = []) {
  vi.mocked(getMeasurements).mockResolvedValue(
    failedUploads.map(({ key, data }) => [key, data]),
  );
  return renderHook(() => useMeasurements(), { wrapper });
}

describe("useMeasurements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  // ---------------------------------------------------------------------------
  // uploadAll
  // ---------------------------------------------------------------------------

  describe("uploadAll", () => {
    it("marks each upload as successful in-place", async () => {
      const { result } = renderMeasurements([{ key: "upload-key-1", data: mockMeasurement }]);
      await waitFor(() => expect(result.current.failedUploads).toHaveLength(1));
      mockSendMqttEvent.mockResolvedValueOnce(undefined);

      await act(() => result.current.uploadAll());

      expect(mockSendMqttEvent).toHaveBeenCalledWith(
        mockMeasurement.topic,
        mockMeasurement.measurementResult,
      );
      expect(mockMarkAsSuccessful).toHaveBeenCalledWith("upload-key-1");
    });

    it("calls markAsUploading with all keys at batch start", async () => {
      const { result } = renderMeasurements([
        { key: "key-1", data: mockMeasurement },
        { key: "key-2", data: { ...mockMeasurement, topic: "test/topic2" } },
      ]);
      await waitFor(() => expect(result.current.failedUploads).toHaveLength(2));
      mockSendMqttEvent.mockResolvedValue(undefined);

      await act(() => result.current.uploadAll());

      expect(mockMarkAsUploading).toHaveBeenCalledWith(["key-1", "key-2"]);
    });

    it("does not call removeMeasurement", async () => {
      const { result } = renderMeasurements([{ key: "upload-key-1", data: mockMeasurement }]);
      await waitFor(() => expect(result.current.failedUploads).toHaveLength(1));
      mockSendMqttEvent.mockResolvedValueOnce(undefined);

      await act(() => result.current.uploadAll());

      expect(mockRemoveMeasurement).not.toHaveBeenCalled();
    });

    it("prunes expired uploads after uploading", async () => {
      const { result } = renderMeasurements([{ key: "upload-key-1", data: mockMeasurement }]);
      await waitFor(() => expect(result.current.failedUploads).toHaveLength(1));
      mockSendMqttEvent.mockResolvedValueOnce(undefined);

      await act(() => result.current.uploadAll());

      expect(mockPruneExpiredMeasurements).toHaveBeenCalledOnce();
    });

    it("calls setQueryData with synced status on per-item success", async () => {
      const setQueryDataSpy = vi.spyOn(queryClient, "setQueryData");
      const { result } = renderMeasurements([{ key: "upload-key-1", data: mockMeasurement }]);
      await waitFor(() => expect(result.current.failedUploads).toHaveLength(1));
      mockSendMqttEvent.mockResolvedValueOnce(undefined);

      await act(() => result.current.uploadAll());

      expect(setQueryDataSpy).toHaveBeenCalledWith(
        ["measurements"],
        expect.any(Function),
      );
      // Verify the updater flips the right key to "synced"
      const updater = setQueryDataSpy.mock.calls.find(
        ([key]) => Array.isArray(key) && key[0] === "measurements",
      )?.[1] as (old: { key: string; status: string }[]) => { key: string; status: string }[];
      const old = [{ key: "upload-key-1", status: "syncing" }];
      expect(updater(old)).toEqual([{ key: "upload-key-1", status: "synced" }]);
    });

    it("calls markAsFailed and setQueryData with unsynced status on per-item failure", async () => {
      const setQueryDataSpy = vi.spyOn(queryClient, "setQueryData");
      const { result } = renderMeasurements([{ key: "upload-key-1", data: mockMeasurement }]);
      await waitFor(() => expect(result.current.failedUploads).toHaveLength(1));
      mockSendMqttEvent.mockRejectedValueOnce(new Error("network error"));
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());

      await act(() => result.current.uploadAll().catch(() => {}));

      expect(mockMarkAsFailed).toHaveBeenCalledWith("upload-key-1");

      const updater = setQueryDataSpy.mock.calls
        .reverse()
        .find(([key]) => Array.isArray(key) && key[0] === "measurements")?.[1] as (
        old: { key: string; status: string }[],
      ) => { key: string; status: string }[];
      const old = [{ key: "upload-key-1", status: "syncing" }];
      expect(updater(old)).toEqual([{ key: "upload-key-1", status: "unsynced" }]);

      consoleSpy.mockRestore();
    });

    it("prunes and invalidates even when a send fails", async () => {
      const { result } = renderMeasurements([{ key: "upload-key-1", data: mockMeasurement }]);
      await waitFor(() => expect(result.current.failedUploads).toHaveLength(1));
      mockSendMqttEvent.mockRejectedValueOnce(new Error("network error"));
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());

      await act(() => result.current.uploadAll().catch(() => {}));

      expect(mockPruneExpiredMeasurements).toHaveBeenCalledOnce();

      consoleSpy.mockRestore();
    });

    it("marks multiple uploads in one pass", async () => {
      const { result } = renderMeasurements([
        { key: "key-1", data: mockMeasurement },
        { key: "key-2", data: { ...mockMeasurement, topic: "test/topic2" } },
      ]);
      await waitFor(() => expect(result.current.failedUploads).toHaveLength(2));
      mockSendMqttEvent.mockResolvedValue(undefined);

      await act(() => result.current.uploadAll());

      expect(mockMarkAsSuccessful).toHaveBeenCalledWith("key-1");
      expect(mockMarkAsSuccessful).toHaveBeenCalledWith("key-2");
      expect(mockMarkAsSuccessful).toHaveBeenCalledTimes(2);
    });

    it("processes all items when count exceeds CONCURRENCY", async () => {
      const uploads = Array.from({ length: 12 }, (_, i) => ({
        key: `key-${i}`,
        data: { ...mockMeasurement, topic: `test/topic${i}` },
      }));
      const { result } = renderMeasurements(uploads);
      await waitFor(() => expect(result.current.failedUploads).toHaveLength(12));
      mockSendMqttEvent.mockResolvedValue(undefined);

      await act(() => result.current.uploadAll());

      expect(mockMarkAsSuccessful).toHaveBeenCalledTimes(12);
      for (const { key } of uploads) {
        expect(mockMarkAsSuccessful).toHaveBeenCalledWith(key);
      }
    });

    it("completes remaining tasks when one worker fails mid-batch", async () => {
      const { result } = renderMeasurements([
        { key: "key-fail", data: mockMeasurement },
        { key: "key-ok-1", data: { ...mockMeasurement, topic: "test/topic2" } },
        { key: "key-ok-2", data: { ...mockMeasurement, topic: "test/topic3" } },
      ]);
      await waitFor(() => expect(result.current.failedUploads).toHaveLength(3));
      mockSendMqttEvent
        .mockRejectedValueOnce(new Error("send failed"))
        .mockResolvedValue(undefined);
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());

      await act(() => result.current.uploadAll().catch(() => {}));

      expect(mockMarkAsSuccessful).not.toHaveBeenCalledWith("key-fail");
      expect(mockMarkAsSuccessful).toHaveBeenCalledWith("key-ok-1");
      expect(mockMarkAsSuccessful).toHaveBeenCalledWith("key-ok-2");

      consoleSpy.mockRestore();
    });

    it("prunes after all items fail", async () => {
      const { result } = renderMeasurements([
        { key: "key-1", data: mockMeasurement },
        { key: "key-2", data: { ...mockMeasurement, topic: "test/topic2" } },
      ]);
      await waitFor(() => expect(result.current.failedUploads).toHaveLength(2));
      mockSendMqttEvent
        .mockRejectedValueOnce(new Error("first error"))
        .mockRejectedValueOnce(new Error("second error"));
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());

      await act(() => result.current.uploadAll().catch(() => {}));

      expect(mockMarkAsSuccessful).not.toHaveBeenCalled();
      expect(mockPruneExpiredMeasurements).toHaveBeenCalledOnce();

      consoleSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // uploadOne
  // ---------------------------------------------------------------------------

  describe("uploadOne", () => {
    it("marks the matching upload as successful", async () => {
      const { result } = renderMeasurements([{ key: "upload-key-1", data: mockMeasurement }]);
      await waitFor(() => expect(result.current.failedUploads).toHaveLength(1));
      mockSendMqttEvent.mockResolvedValueOnce(undefined);

      await act(() => result.current.uploadOne("upload-key-1"));

      expect(mockMarkAsSuccessful).toHaveBeenCalledWith("upload-key-1");
      expect(mockRemoveMeasurement).not.toHaveBeenCalled();
    });

    it("prunes after a single upload", async () => {
      const { result } = renderMeasurements([{ key: "upload-key-1", data: mockMeasurement }]);
      await waitFor(() => expect(result.current.failedUploads).toHaveLength(1));
      mockSendMqttEvent.mockResolvedValueOnce(undefined);

      await act(() => result.current.uploadOne("upload-key-1"));

      expect(mockPruneExpiredMeasurements).toHaveBeenCalledOnce();
    });

    it("invalidates measurements after upload", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      const { result } = renderMeasurements([{ key: "upload-key-1", data: mockMeasurement }]);
      await waitFor(() => expect(result.current.failedUploads).toHaveLength(1));
      mockSendMqttEvent.mockResolvedValueOnce(undefined);

      await act(() => result.current.uploadOne("upload-key-1"));

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["measurements"] });
    });

    it("shows toast, calls markAsFailed, and still prunes when MQTT send fails", async () => {
      const { result } = renderMeasurements([{ key: "upload-key-1", data: mockMeasurement }]);
      await waitFor(() => expect(result.current.failedUploads).toHaveLength(1));
      mockSendMqttEvent.mockRejectedValueOnce(new Error("timeout"));
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());

      await act(() => result.current.uploadOne("upload-key-1"));

      expect(mockMarkAsSuccessful).not.toHaveBeenCalled();
      expect(mockMarkAsFailed).toHaveBeenCalledWith("upload-key-1");
      expect(mockToastInfo).toHaveBeenCalledWith("Failed to upload, try again later");
      expect(mockPruneExpiredMeasurements).toHaveBeenCalledOnce();

      consoleSpy.mockRestore();
    });

    it("does nothing when key is not found", async () => {
      const { result } = renderMeasurements([]);
      await waitFor(() => expect(result.current.failedUploads).toHaveLength(0));

      await act(() => result.current.uploadOne("non-existent-key"));

      expect(mockSendMqttEvent).not.toHaveBeenCalled();
      expect(mockMarkAsSuccessful).not.toHaveBeenCalled();
      expect(mockPruneExpiredMeasurements).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // saveMeasurement
  // ---------------------------------------------------------------------------

  describe("saveMeasurement", () => {
    it("saves as failed and invalidates measurements", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      const { result } = renderMeasurements([]);

      await act(() => result.current.saveMeasurement(mockMeasurement, "failed"));

      expect(mockSaveMeasurement).toHaveBeenCalledWith(mockMeasurement, "failed");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["measurements"] });
    });

    it("saves as successful and invalidates measurements", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      const { result } = renderMeasurements([]);

      await act(() => result.current.saveMeasurement(mockMeasurement, "successful"));

      expect(mockSaveMeasurement).toHaveBeenCalledWith(mockMeasurement, "successful");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["measurements"] });
    });
  });

  // ---------------------------------------------------------------------------
  // removeMeasurement
  // ---------------------------------------------------------------------------

  describe("removeMeasurement", () => {
    it("removes a measurement and invalidates", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      const { result } = renderMeasurements([]);

      await act(() => result.current.removeMeasurement("key-1"));

      expect(mockRemoveMeasurement).toHaveBeenCalledWith("key-1");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["measurements"] });
    });
  });

  // ---------------------------------------------------------------------------
  // clearSyncedMeasurements
  // ---------------------------------------------------------------------------

  describe("clearSyncedMeasurements", () => {
    it("clears successful measurements and invalidates", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      const { result } = renderMeasurements([]);

      await act(() => result.current.clearSyncedMeasurements());

      expect(mockClearMeasurements).toHaveBeenCalledWith("successful");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["measurements"] });
    });
  });

  // ---------------------------------------------------------------------------
  // updateMeasurementComment
  // ---------------------------------------------------------------------------

  describe("updateMeasurementComment", () => {
    it("updates measurement with built annotations and invalidates", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      const { result } = renderMeasurements([]);

      await act(() => result.current.updateMeasurementComment("key-1", mockMeasurement, "a comment"));

      expect(mockUpdateMeasurement).toHaveBeenCalledWith("key-1", {
        ...mockMeasurement,
        measurementResult: {
          ...mockMeasurement.measurementResult,
          annotations: { comment: "a comment" },
        },
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["measurements"] });
    });
  });
});
