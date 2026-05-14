import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { MeasurementItem } from "../use-all-measurements";
import { useRecentMeasurementsActions } from "../use-recent-measurements-actions";

const mockUploadAll = vi.fn().mockResolvedValue(undefined);
const mockUploadOne = vi.fn().mockResolvedValue(undefined);
const mockRemoveMeasurement = vi.fn().mockResolvedValue(undefined);
const mockClearSyncedMeasurements = vi.fn().mockResolvedValue(undefined);
const mockUpdateMeasurementComment = vi.fn().mockResolvedValue(undefined);
const mockInvalidate = vi.fn();
const mockShowAlert = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
const mockExportMeasurementsToFile = vi.fn().mockResolvedValue(undefined);

vi.mock("~/features/recent-measurements/hooks/use-all-measurements", () => ({
  useAllMeasurements: vi.fn(() => ({
    measurements: mockAllMeasurements,
    counts: { pending: 0, uploading: 1, failed: 1, successful: 1 },
    uploadingCount: 1,
    invalidate: mockInvalidate,
  })),
}));

vi.mock("~/features/recent-measurements/hooks/use-measurements", () => ({
  useMeasurements: vi.fn(() => ({
    uploadAll: mockUploadAll,
    isUploading: false,
    uploadOne: mockUploadOne,
    removeMeasurement: mockRemoveMeasurement,
    clearSyncedMeasurements: mockClearSyncedMeasurements,
    updateMeasurementComment: mockUpdateMeasurementComment,
  })),
}));

vi.mock("~/shared/ui/AlertDialog", () => ({
  showAlert: (...args: unknown[]) => mockShowAlert(...args),
}));

vi.mock("sonner-native", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

vi.mock("~/features/recent-measurements/services/export-measurements", () => ({
  exportMeasurementsToFile: () => mockExportMeasurementsToFile(),
}));

vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      const count = vars?.count as number | undefined;
      const name = vars?.name as string | undefined;
      const map: Record<string, string> = {
        "common:cancel": "Cancel",
        "common:delete": "Delete",
        "recentMeasurements:alerts.uploadMeasurementTitle": "Upload Measurement",
        "recentMeasurements:alerts.uploadMeasurementMessage": `Are you sure you want to upload "${name}"?`,
        "recentMeasurements:alerts.uploadButton": "Upload",
        "recentMeasurements:alerts.uploadMeasurementError":
          "Failed to upload measurement. Please try again.",
        "recentMeasurements:alerts.deleteMeasurementTitle": "Delete Measurement",
        "recentMeasurements:alerts.removeMeasurementTitle": "Remove Measurement",
        "recentMeasurements:alerts.deleteMeasurementMessage": `Are you sure you want to delete "${name}" from local storage?`,
        "recentMeasurements:alerts.removeMeasurementMessage": `Are you sure you want to remove "${name}"? This will delete it from local storage.`,
        "recentMeasurements:alerts.removeButton": "Remove",
        "recentMeasurements:alerts.deleteMeasurementError":
          "Failed to delete measurement. Please try again.",
        "recentMeasurements:alerts.uploadAllTitle": "Upload All Measurements",
        "recentMeasurements:alerts.uploadAllMessage":
          count === 1
            ? `Are you sure you want to sync ${count} unsynced measurement?`
            : `Are you sure you want to sync ${count} unsynced measurements?`,
        "recentMeasurements:alerts.uploadAllButton": "Upload All",
        "recentMeasurements:alerts.uploadAllError": "Sync failed. Please try again.",
        "recentMeasurements:alerts.uploadAllSuccess": "All measurements synced successfully",
        "recentMeasurements:alerts.deleteAllSyncedTitle": "Delete all synced measurements",
        "recentMeasurements:alerts.deleteAllSyncedMessage": `Are you sure you want to delete all ${count} synced measurements from local storage?`,
        "recentMeasurements:alerts.deleteAllSyncedError": "Failed to delete synced measurements",
        "recentMeasurements:alerts.exportError": "Export failed. Please try again.",
      };
      return map[key] ?? key;
    },
  }),
}));

const makeItem = (
  key: string,
  status: MeasurementItem["status"],
  experimentName = "Exp",
): MeasurementItem => ({
  key,
  status,
  experimentName,
  timestamp: "2026-01-01T10:00:00Z",
  questions: [],
  data: {
    topic: "t/t",
    measurementResult: {},
    metadata: { experimentName, protocolName: "p", timestamp: "2026-01-01T10:00:00Z" },
  },
});

const mockAllMeasurements: MeasurementItem[] = [
  makeItem("k1", "failed", "Exp Unsynced"),
  makeItem("k2", "successful", "Exp Synced"),
  makeItem("k3", "uploading", "Exp Syncing"),
];

describe("useRecentMeasurementsActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns derived counts and passthrough values", () => {
    const { result } = renderHook(() => useRecentMeasurementsActions("all"));

    expect(result.current.unsyncedCount).toBe(1);
    expect(result.current.syncedCount).toBe(1);
    expect(result.current.hasAnyMeasurements).toBe(true);
    expect(result.current.uploadingCount).toBe(1);
    expect(result.current.isUploading).toBe(false);
    expect(result.current.measurements).toBe(mockAllMeasurements);
  });

  describe("confirmSync", () => {
    it("shows upload alert with measurement name", () => {
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));
      const m = makeItem("k1", "failed", "My Experiment");

      act(() => result.current.confirmSync(m));

      expect(mockShowAlert).toHaveBeenCalledWith(
        "Upload Measurement",
        expect.stringContaining("My Experiment"),
        expect.any(Array),
      );
    });

    it("calls uploadOne and invalidates on confirm", async () => {
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));
      const m = makeItem("k1", "failed");

      act(() => result.current.confirmSync(m));
      const [confirmBtn] = mockShowAlert.mock.calls[0][2];
      await act(() => confirmBtn.onPress());

      expect(mockUploadOne).toHaveBeenCalledWith("k1");
      expect(mockInvalidate).toHaveBeenCalled();
    });

    it("invalidates even when uploadOne throws", async () => {
      mockUploadOne.mockRejectedValueOnce(new Error("network"));
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      act(() => result.current.confirmSync(makeItem("k1", "failed")));
      const [confirmBtn] = mockShowAlert.mock.calls[0][2];
      await act(async () => {
        confirmBtn.onPress();
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockInvalidate).toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledWith(
        "Failed to upload measurement. Please try again.",
      );
    });
  });

  describe("confirmDelete", () => {
    it("shows 'Remove from phone' title for synced items", () => {
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      act(() => result.current.confirmDelete(makeItem("k2", "successful")));

      expect(mockShowAlert).toHaveBeenCalledWith(
        "Remove from phone",
        expect.any(String),
        expect.any(Array),
      );
    });

    it("shows 'Delete unsynced measurement' title for unsynced items", () => {
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      act(() => result.current.confirmDelete(makeItem("k1", "failed")));

      expect(mockShowAlert).toHaveBeenCalledWith(
        "Delete unsynced measurement",
        expect.any(String),
        expect.any(Array),
      );
    });

    it("calls removeMeasurement and invalidates on confirm", async () => {
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));
      const m = makeItem("k1", "failed");

      act(() => result.current.confirmDelete(m));
      const [confirmBtn] = mockShowAlert.mock.calls[0][2];
      await act(() => confirmBtn.onPress());

      expect(mockRemoveMeasurement).toHaveBeenCalledWith("k1");
      expect(mockInvalidate).toHaveBeenCalled();
    });
  });

  describe("confirmSyncAll", () => {
    it("shows upload all alert", () => {
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      act(() => result.current.confirmSyncAll());

      expect(mockShowAlert).toHaveBeenCalledWith(
        "Upload All Measurements",
        expect.any(String),
        expect.any(Array),
      );
    });

    it("calls uploadAll, toasts success, and invalidates on confirm", async () => {
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      act(() => result.current.confirmSyncAll());
      const [confirmBtn] = mockShowAlert.mock.calls[0][2];
      await act(() => confirmBtn.onPress());

      expect(mockUploadAll).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith("All measurements synced successfully");
      expect(mockInvalidate).toHaveBeenCalled();
    });
  });

  describe("confirmDeleteAllSynced", () => {
    it("shows delete all synced alert", () => {
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      act(() => result.current.confirmDeleteAllSynced());

      expect(mockShowAlert).toHaveBeenCalledWith(
        "Delete all synced measurements",
        expect.any(String),
        expect.any(Array),
      );
    });

    it("calls clearSyncedMeasurements and invalidates on confirm", async () => {
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      act(() => result.current.confirmDeleteAllSynced());
      const [confirmBtn] = mockShowAlert.mock.calls[0][2];
      await act(() => confirmBtn.onPress());

      expect(mockClearSyncedMeasurements).toHaveBeenCalled();
      expect(mockInvalidate).toHaveBeenCalled();
    });
  });

  describe("handleExport", () => {
    it("calls exportMeasurementsToFile", async () => {
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      act(() => result.current.handleExport());
      await act(() => new Promise((r) => setTimeout(r, 0)));

      expect(mockExportMeasurementsToFile).toHaveBeenCalled();
    });

    it("shows toast error when export fails", async () => {
      mockExportMeasurementsToFile.mockRejectedValueOnce(new Error("disk full"));
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      act(() => result.current.handleExport());
      await act(() => new Promise((r) => setTimeout(r, 0)));

      expect(mockToastError).toHaveBeenCalledWith("Export failed. Please try again.");
    });
  });

  describe("saveComment", () => {
    it("calls updateMeasurementComment and invalidates", async () => {
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));
      const m = makeItem("k1", "failed");

      await act(() => result.current.saveComment(m, "great result"));

      expect(mockUpdateMeasurementComment).toHaveBeenCalledWith("k1", m.data, "great result");
      expect(mockInvalidate).toHaveBeenCalled();
    });
  });
});
