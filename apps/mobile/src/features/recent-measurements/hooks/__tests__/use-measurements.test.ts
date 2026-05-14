// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMeasurements } from "~/shared/db/measurements-storage";

import { useMeasurements } from "../use-measurements";

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
  mockMarkAsUploading: vi.fn().mockImplementation((keys: string[]) => Promise.resolve(keys)),
  mockMarkAsFailed: vi.fn().mockResolvedValue(undefined),
  mockRemoveMeasurement: vi.fn().mockResolvedValue(undefined),
  mockSaveMeasurement: vi.fn().mockResolvedValue("generated-id"),
  mockUpdateMeasurement: vi.fn().mockResolvedValue(undefined),
  mockClearMeasurements: vi.fn().mockResolvedValue(undefined),
  mockSendMqttEvent: vi.fn(),
  mockPruneExpiredMeasurements: vi.fn().mockResolvedValue(undefined),
  mockToastInfo: vi.fn(),
}));

vi.mock("~/shared/db/measurements-storage", () => ({
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

vi.mock("~/shared/utils/measurement-annotations", () => ({
  buildAnnotations: (text: string, flagType: string | null) => ({ comment: text, flagType }),
  getFlagTypeFromMeasurementResult: () => null,
}));

vi.mock("~/features/connection/services/mqtt/send-mqtt-event", () => ({
  sendMqttEvent: mockSendMqttEvent,
}));

vi.mock("sonner-native", () => ({
  toast: { info: mockToastInfo },
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

let queryClient: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function renderMeasurements(
  failedUploads: { key: string; data: typeof mockMeasurement }[] = [],
  pendingUploads: { key: string; data: typeof mockMeasurement }[] = [],
) {
  // The hook batches pending + failed into a single getMeasurements call and
  // expects { id, status, data } objects back.
  vi.mocked(getMeasurements).mockImplementation((status) => {
    const wanted = new Set(Array.isArray(status) ? status : [status]);
    const out: { id: string; status: "pending" | "failed"; data: typeof mockMeasurement }[] = [];
    if (wanted.has("failed")) {
      out.push(
        ...failedUploads.map(({ key, data }) => ({ id: key, status: "failed" as const, data })),
      );
    }
    if (wanted.has("pending")) {
      out.push(
        ...pendingUploads.map(({ key, data }) => ({ id: key, status: "pending" as const, data })),
      );
    }
    return Promise.resolve(out);
  });
  return renderHook(() => useMeasurements(), { wrapper });
}

describe("useMeasurements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMqttEvent.mockReset();
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

    it("calls markAsFailed on per-item failure", async () => {
      const { result } = renderMeasurements([{ key: "upload-key-1", data: mockMeasurement }]);
      await waitFor(() => expect(result.current.failedUploads).toHaveLength(1));
      mockSendMqttEvent.mockRejectedValueOnce(new Error("network error"));
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());

      await act(() => result.current.uploadAll().catch(() => undefined));

      expect(mockMarkAsFailed).toHaveBeenCalledWith("upload-key-1");

      consoleSpy.mockRestore();
    });

    // Status changes must propagate to the list cache the Recent screen
    // reads (["measurements", "list", filter]). Writing to ["measurements"]
    // alone wouldn't, so this asserts we never take that shortcut and rely
    // on prefix-matching invalidateQueries({ queryKey: ["measurements"] })
    // instead.
    it("does not call setQueryData with the bare ['measurements'] key", async () => {
      const setQueryDataSpy = vi.spyOn(queryClient, "setQueryData");
      const { result } = renderMeasurements([{ key: "upload-key-1", data: mockMeasurement }]);
      await waitFor(() => expect(result.current.failedUploads).toHaveLength(1));
      mockSendMqttEvent.mockResolvedValueOnce(undefined);

      await act(() => result.current.uploadAll());

      const bareMeasurementsCalls = setQueryDataSpy.mock.calls.filter(
        ([key]) => Array.isArray(key) && key.length === 1 && key[0] === "measurements",
      );
      expect(bareMeasurementsCalls).toHaveLength(0);
    });

    it("invalidates ['measurements'] so list and counts caches refresh", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      const { result } = renderMeasurements([{ key: "upload-key-1", data: mockMeasurement }]);
      await waitFor(() => expect(result.current.failedUploads).toHaveLength(1));
      mockSendMqttEvent.mockResolvedValueOnce(undefined);

      await act(() => result.current.uploadAll());

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["measurements"] });
    });

    // Once the publish succeeds the data is on the cloud, so a local
    // markAsSuccessful failure must be swallowed (logged, not surfaced) and
    // must not flip the row to "failed". The batch keeps going.
    it("does not mark the row failed when markAsSuccessful errors after a successful publish", async () => {
      const { result } = renderMeasurements([{ key: "upload-key-1", data: mockMeasurement }]);
      await waitFor(() => expect(result.current.failedUploads).toHaveLength(1));
      mockSendMqttEvent.mockResolvedValueOnce(undefined);
      mockMarkAsSuccessful.mockRejectedValueOnce(new Error("disk full"));
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());

      await act(() => result.current.uploadAll());

      expect(mockMarkAsFailed).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Local status update failed after successful publish"),
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it("prunes and invalidates even when a send fails", async () => {
      const { result } = renderMeasurements([{ key: "upload-key-1", data: mockMeasurement }]);
      await waitFor(() => expect(result.current.failedUploads).toHaveLength(1));
      mockSendMqttEvent.mockRejectedValueOnce(new Error("network error"));
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());

      await act(() => result.current.uploadAll().catch(() => undefined));

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

      await act(() => result.current.uploadAll().catch(() => undefined));

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

      await act(() => result.current.uploadAll().catch(() => undefined));

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

    it("short-circuits concurrent uploadOne calls for the same key", async () => {
      const { result } = renderMeasurements([{ key: "upload-key-1", data: mockMeasurement }]);
      await waitFor(() => expect(result.current.failedUploads).toHaveLength(1));
      mockSendMqttEvent.mockResolvedValueOnce(undefined);

      await act(async () => {
        const first = result.current.uploadOne("upload-key-1");
        const second = result.current.uploadOne("upload-key-1");
        await Promise.all([first, second]);
      });

      expect(mockSendMqttEvent).toHaveBeenCalledTimes(1);
      expect(mockMarkAsUploading).toHaveBeenCalledTimes(1);
      expect(mockMarkAsSuccessful).toHaveBeenCalledTimes(1);
    });

    it("releases the in-flight key on success so it can be retried", async () => {
      const { result } = renderMeasurements([{ key: "upload-key-1", data: mockMeasurement }]);
      await waitFor(() => expect(result.current.failedUploads).toHaveLength(1));
      mockSendMqttEvent.mockResolvedValue(undefined);

      await act(() => result.current.uploadOne("upload-key-1"));
      await act(() => result.current.uploadOne("upload-key-1"));

      expect(mockMarkAsUploading).toHaveBeenCalledTimes(2);
      expect(mockSendMqttEvent).toHaveBeenCalledTimes(2);
    });

    it("releases the in-flight key on failure", async () => {
      const { result } = renderMeasurements([{ key: "upload-key-1", data: mockMeasurement }]);
      await waitFor(() => expect(result.current.failedUploads).toHaveLength(1));
      mockSendMqttEvent.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(undefined);
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());

      await act(() => result.current.uploadOne("upload-key-1"));
      await act(() => result.current.uploadOne("upload-key-1"));

      expect(mockMarkAsUploading).toHaveBeenCalledTimes(2);
      expect(mockSendMqttEvent).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });

    it("skips sendMqttEvent when markAsUploading reports no transition", async () => {
      mockMarkAsUploading.mockResolvedValueOnce([]);
      const { result } = renderMeasurements([{ key: "upload-key-1", data: mockMeasurement }]);
      await waitFor(() => expect(result.current.failedUploads).toHaveLength(1));

      await act(() => result.current.uploadOne("upload-key-1"));

      expect(mockSendMqttEvent).not.toHaveBeenCalled();
      expect(mockMarkAsSuccessful).not.toHaveBeenCalled();
      expect(mockMarkAsFailed).not.toHaveBeenCalled();
      expect(mockPruneExpiredMeasurements).not.toHaveBeenCalled();
    });

    // See the matching uploadAll regression test — list caches are keyed
    // ["measurements", "list", filter], so bare ["measurements"] writes miss
    // every visible row. uploadOne must rely on invalidateQueries instead.
    it("does not call setQueryData with the bare ['measurements'] key", async () => {
      const setQueryDataSpy = vi.spyOn(queryClient, "setQueryData");
      const { result } = renderMeasurements([{ key: "upload-key-1", data: mockMeasurement }]);
      await waitFor(() => expect(result.current.failedUploads).toHaveLength(1));
      mockSendMqttEvent.mockResolvedValueOnce(undefined);

      await act(() => result.current.uploadOne("upload-key-1"));

      const bareMeasurementsCalls = setQueryDataSpy.mock.calls.filter(
        ([key]) => Array.isArray(key) && key.length === 1 && key[0] === "measurements",
      );
      expect(bareMeasurementsCalls).toHaveLength(0);
    });

    it("does not mark the row failed when markAsSuccessful errors after a successful publish", async () => {
      const { result } = renderMeasurements([{ key: "upload-key-1", data: mockMeasurement }]);
      await waitFor(() => expect(result.current.failedUploads).toHaveLength(1));
      mockSendMqttEvent.mockResolvedValueOnce(undefined);
      mockMarkAsSuccessful.mockRejectedValueOnce(new Error("disk full"));
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());

      await act(() => result.current.uploadOne("upload-key-1"));

      expect(mockMarkAsFailed).not.toHaveBeenCalled();
      expect(mockToastInfo).not.toHaveBeenCalledWith("Failed to upload, try again later");
      // Prune + invalidate still run via the finally so the UI refreshes.
      expect(mockPruneExpiredMeasurements).toHaveBeenCalledOnce();

      consoleSpy.mockRestore();
    });

    it("releases the in-flight key when transition is rejected", async () => {
      mockMarkAsUploading.mockResolvedValueOnce([]).mockResolvedValueOnce(["upload-key-1"]);
      const { result } = renderMeasurements([{ key: "upload-key-1", data: mockMeasurement }]);
      await waitFor(() => expect(result.current.failedUploads).toHaveLength(1));
      mockSendMqttEvent.mockResolvedValueOnce(undefined);

      await act(() => result.current.uploadOne("upload-key-1"));
      await act(() => result.current.uploadOne("upload-key-1"));

      expect(mockMarkAsUploading).toHaveBeenCalledTimes(2);
      expect(mockSendMqttEvent).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // saveMeasurement
  // ---------------------------------------------------------------------------

  describe("saveMeasurement", () => {
    it("saves as failed, invalidates, and returns the new id", async () => {
      mockSaveMeasurement.mockResolvedValueOnce("new-id");
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      const { result } = renderMeasurements([]);

      let returned: string | undefined;
      await act(async () => {
        returned = await result.current.saveMeasurement(mockMeasurement, "failed");
      });

      expect(mockSaveMeasurement).toHaveBeenCalledWith(mockMeasurement, "failed");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["measurements"] });
      expect(returned).toBe("new-id");
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
  // markUploaded
  // ---------------------------------------------------------------------------

  describe("markUploaded", () => {
    it("marks the row as successful and invalidates measurements", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      const { result } = renderMeasurements([]);

      await act(() => result.current.markUploaded("key-1"));

      expect(mockMarkAsSuccessful).toHaveBeenCalledWith("key-1");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["measurements"] });
    });
  });

  // ---------------------------------------------------------------------------
  // markFailed
  // ---------------------------------------------------------------------------

  describe("markFailed", () => {
    it("marks the row as failed and invalidates measurements", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      const { result } = renderMeasurements([]);

      await act(() => result.current.markFailed("key-1"));

      expect(mockMarkAsFailed).toHaveBeenCalledWith("key-1");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["measurements"] });
    });
  });

  // ---------------------------------------------------------------------------
  // failedUploads query — covers both pending and failed rows
  // ---------------------------------------------------------------------------

  describe("failedUploads query", () => {
    it("includes both pending and failed rows", async () => {
      const { result } = renderMeasurements(
        [{ key: "failed-1", data: mockMeasurement }],
        [{ key: "pending-1", data: mockMeasurement }],
      );

      await waitFor(() => expect(result.current.failedUploads).toHaveLength(2));
      const keys = result.current.failedUploads.map((u) => u.key).sort();
      expect(keys).toEqual(["failed-1", "pending-1"]);
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

      await act(() =>
        result.current.updateMeasurementComment("key-1", mockMeasurement, "a comment"),
      );

      expect(mockUpdateMeasurement).toHaveBeenCalledWith("key-1", {
        ...mockMeasurement,
        measurementResult: {
          ...mockMeasurement.measurementResult,
          annotations: { comment: "a comment", flagType: null },
        },
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["measurements"] });
    });
  });
});
