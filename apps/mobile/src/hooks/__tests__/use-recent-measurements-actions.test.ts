import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { useRecentMeasurementsActions } from "../../components/recent-measurements-screen/use-recent-measurements-actions";
import type { MeasurementItem } from "../use-all-measurements";

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

vi.mock("~/hooks/use-all-measurements", () => ({
  useAllMeasurements: vi.fn(() => ({
    measurements: mockAllMeasurements,
    allMeasurements: mockAllMeasurements,
    uploadingCount: 1,
    invalidate: mockInvalidate,
  })),
}));

vi.mock("~/hooks/use-measurements", () => ({
  useMeasurements: vi.fn(() => ({
    uploadAll: mockUploadAll,
    isUploading: false,
    uploadOne: mockUploadOne,
    removeMeasurement: mockRemoveMeasurement,
    clearSyncedMeasurements: mockClearSyncedMeasurements,
    updateMeasurementComment: mockUpdateMeasurementComment,
  })),
}));

vi.mock("~/components/AlertDialog", () => ({
  showAlert: (...args: unknown[]) => mockShowAlert(...args),
}));

vi.mock("sonner-native", () => ({
  toast: { error: (...args: unknown[]) => mockToastError(...args), success: (...args: unknown[]) => mockToastSuccess(...args) },
}));

vi.mock("~/services/export-measurements", () => ({
  exportMeasurementsToFile: () => mockExportMeasurementsToFile(),
}));

const makeItem = (key: string, status: MeasurementItem["status"], experimentName = "Exp"): MeasurementItem => ({
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
  makeItem("k1", "unsynced", "Exp Unsynced"),
  makeItem("k2", "synced", "Exp Synced"),
  makeItem("k3", "syncing", "Exp Syncing"),
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
      const m = makeItem("k1", "unsynced", "My Experiment");

      act(() => result.current.confirmSync(m));

      expect(mockShowAlert).toHaveBeenCalledWith(
        "Upload Measurement",
        expect.stringContaining("My Experiment"),
        expect.any(Array),
      );
    });

    it("calls uploadOne and invalidates on confirm", async () => {
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));
      const m = makeItem("k1", "unsynced");

      act(() => result.current.confirmSync(m));
      const [confirmBtn] = mockShowAlert.mock.calls[0][2];
      await act(async () => confirmBtn.onPress());

      expect(mockUploadOne).toHaveBeenCalledWith("k1");
      expect(mockInvalidate).toHaveBeenCalled();
    });

    it("invalidates even when uploadOne throws", async () => {
      mockUploadOne.mockRejectedValueOnce(new Error("network"));
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      act(() => result.current.confirmSync(makeItem("k1", "unsynced")));
      const [confirmBtn] = mockShowAlert.mock.calls[0][2];
      await act(async () => {
        confirmBtn.onPress();
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockInvalidate).toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledWith("Failed to upload measurement. Please try again.");
    });
  });

  describe("confirmDelete", () => {
    it("shows 'Delete Measurement' title for synced items", () => {
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      act(() => result.current.confirmDelete(makeItem("k2", "synced")));

      expect(mockShowAlert).toHaveBeenCalledWith("Delete Measurement", expect.any(String), expect.any(Array));
    });

    it("shows 'Remove Measurement' title for unsynced items", () => {
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      act(() => result.current.confirmDelete(makeItem("k1", "unsynced")));

      expect(mockShowAlert).toHaveBeenCalledWith("Remove Measurement", expect.any(String), expect.any(Array));
    });

    it("calls removeMeasurement and invalidates on confirm", async () => {
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));
      const m = makeItem("k1", "unsynced");

      act(() => result.current.confirmDelete(m));
      const [confirmBtn] = mockShowAlert.mock.calls[0][2];
      await act(async () => confirmBtn.onPress());

      expect(mockRemoveMeasurement).toHaveBeenCalledWith("k1");
      expect(mockInvalidate).toHaveBeenCalled();
    });
  });

  describe("confirmSyncAll", () => {
    it("shows upload all alert", () => {
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      act(() => result.current.confirmSyncAll());

      expect(mockShowAlert).toHaveBeenCalledWith("Upload All Measurements", expect.any(String), expect.any(Array));
    });

    it("calls uploadAll, toasts success, and invalidates on confirm", async () => {
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      act(() => result.current.confirmSyncAll());
      const [confirmBtn] = mockShowAlert.mock.calls[0][2];
      await act(async () => confirmBtn.onPress());

      expect(mockUploadAll).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith("All measurements synced successfully");
      expect(mockInvalidate).toHaveBeenCalled();
    });
  });

  describe("confirmDeleteAllSynced", () => {
    it("shows delete all synced alert", () => {
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      act(() => result.current.confirmDeleteAllSynced());

      expect(mockShowAlert).toHaveBeenCalledWith("Delete all synced measurements", expect.any(String), expect.any(Array));
    });

    it("calls clearSyncedMeasurements and invalidates on confirm", async () => {
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      act(() => result.current.confirmDeleteAllSynced());
      const [confirmBtn] = mockShowAlert.mock.calls[0][2];
      await act(async () => confirmBtn.onPress());

      expect(mockClearSyncedMeasurements).toHaveBeenCalled();
      expect(mockInvalidate).toHaveBeenCalled();
    });
  });

  describe("handleExport", () => {
    it("calls exportMeasurementsToFile", async () => {
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      act(() => result.current.handleExport());
      await act(async () => new Promise((r) => setTimeout(r, 0)));

      expect(mockExportMeasurementsToFile).toHaveBeenCalled();
    });

    it("shows toast error when export fails", async () => {
      mockExportMeasurementsToFile.mockRejectedValueOnce(new Error("disk full"));
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      act(() => result.current.handleExport());
      await act(async () => new Promise((r) => setTimeout(r, 0)));

      expect(mockToastError).toHaveBeenCalledWith("Export failed. Please try again.");
    });
  });

  describe("saveComment", () => {
    it("calls updateMeasurementComment and invalidates", async () => {
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));
      const m = makeItem("k1", "unsynced");

      await act(async () => result.current.saveComment(m, "great result"));

      expect(mockUpdateMeasurementComment).toHaveBeenCalledWith("k1", m.data, "great result");
      expect(mockInvalidate).toHaveBeenCalled();
    });
  });
});
