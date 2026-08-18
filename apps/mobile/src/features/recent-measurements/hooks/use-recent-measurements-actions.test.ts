import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MeasurementItem } from "~/features/recent-measurements/hooks/use-all-measurements";
import { useRecentMeasurementsActions } from "~/features/recent-measurements/hooks/use-recent-measurements-actions";

const mockUploadAll = vi.fn().mockResolvedValue(undefined);
const mockUploadOne = vi.fn().mockResolvedValue(undefined);
const mockUploadMany = vi.fn().mockResolvedValue(undefined);
const mockRemoveMeasurement = vi.fn().mockResolvedValue(undefined);
const mockRemoveMeasurements = vi.fn().mockResolvedValue(undefined);
const mockClearSyncedMeasurements = vi.fn().mockResolvedValue(undefined);
const mockUpdateMeasurementComment = vi.fn().mockResolvedValue(undefined);
const mockGetMeasurementIdsByRunId =
  vi.fn<(runId: string, statuses?: string[]) => Promise<string[]>>();
const mockInvalidate = vi.fn();
const mockShowAlert = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
const mockExportMeasurementsToFile = vi.fn().mockResolvedValue(undefined);

vi.mock("~/shared/db/measurements-storage", () => ({
  // Forward exactly the args received, so a one-arg call asserts as such.
  getMeasurementIdsByRunId: (...args: [runId: string, statuses?: string[]]) =>
    mockGetMeasurementIdsByRunId(...args),
}));

vi.mock("~/features/recent-measurements/hooks/use-all-measurements", () => ({
  useAllMeasurements: vi.fn(() => ({
    measurements: mockAllMeasurements,
    counts: { pending: 0, failed: 1, successful: 1 },
    invalidate: mockInvalidate,
  })),
}));

vi.mock("~/features/recent-measurements/hooks/use-measurements", () => ({
  useMeasurements: vi.fn(() => ({
    uploadAll: mockUploadAll,
    isUploading: false,
    uploadOne: mockUploadOne,
    uploadMany: mockUploadMany,
    removeMeasurement: mockRemoveMeasurement,
    removeMeasurements: mockRemoveMeasurements,
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
        "recentMeasurements:alerts.uploadRunTitle": "Upload Workbook Run",
        "recentMeasurements:alerts.uploadRunMessage": `Upload ${count} unsynced from "${name}" run?`,
        "recentMeasurements:alerts.deleteRunTitle": "Delete Workbook Run",
        "recentMeasurements:alerts.deleteRunMessage": `Delete ${count} from "${name}" run?`,
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
        "recentMeasurements:alerts.commentSaveError":
          "Could not save the comment. Please try again.",
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
  id: key,
  key,
  status,
  experimentName,
  protocolName: "p",
  timestamp: "2026-01-01T10:00:00Z",
  questions: [],
  hasComment: false,
  dayKey: "2026-01-01",
  workbookRunId: "",
});

const mockAllMeasurements: MeasurementItem[] = [
  makeItem("k1", "failed", "Exp Unsynced"),
  makeItem("k2", "successful", "Exp Synced"),
  makeItem("k3", "pending", "Exp Pending"),
];

describe("useRecentMeasurementsActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes the measurement list through", () => {
    const { result } = renderHook(() => useRecentMeasurementsActions("all"));

    // Counts moved to useMeasurementCounts (toolbar-owned); the actions hook
    // no longer subscribes to them, keeping the screen off the settle-tick
    // re-render path. See OJD-1470.
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
    it("shows the Remove Measurement title for synced items", () => {
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      act(() => result.current.confirmDelete(makeItem("k2", "successful")));

      expect(mockShowAlert).toHaveBeenCalledWith(
        "Remove Measurement",
        expect.any(String),
        expect.any(Array),
      );
    });

    it("shows the Delete Measurement title for unsynced items", () => {
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      act(() => result.current.confirmDelete(makeItem("k1", "failed")));

      expect(mockShowAlert).toHaveBeenCalledWith(
        "Delete Measurement",
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

    it("confirms with the danger variant", () => {
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      act(() => result.current.confirmDelete(makeItem("k1", "failed")));

      const [confirmBtn] = mockShowAlert.mock.calls[0][2];
      expect(confirmBtn.variant).toBe("danger");
    });

    it("still invalidates when the delete fails", async () => {
      mockRemoveMeasurement.mockRejectedValueOnce(new Error("db locked"));
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      act(() => result.current.confirmDelete(makeItem("k1", "failed")));
      const [confirmBtn] = mockShowAlert.mock.calls[0][2];
      await act(async () => {
        confirmBtn.onPress();
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockInvalidate).toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledWith(
        "Failed to delete measurement. Please try again.",
      );
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

    it("calls uploadAll and invalidates on confirm (no success toast)", async () => {
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      act(() => result.current.confirmSyncAll());
      const [confirmBtn] = mockShowAlert.mock.calls[0][2];
      await act(() => confirmBtn.onPress());

      expect(mockUploadAll).toHaveBeenCalled();
      expect(mockToastSuccess).not.toHaveBeenCalled();
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

    it("confirms with the danger variant", () => {
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      act(() => result.current.confirmDeleteAllSynced());

      const [confirmBtn] = mockShowAlert.mock.calls[0][2];
      expect(confirmBtn.variant).toBe("danger");
    });

    it("still invalidates when the clear fails", async () => {
      mockClearSyncedMeasurements.mockRejectedValueOnce(new Error("db locked"));
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      act(() => result.current.confirmDeleteAllSynced());
      const [confirmBtn] = mockShowAlert.mock.calls[0][2];
      await act(async () => {
        confirmBtn.onPress();
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockInvalidate).toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledWith("Failed to delete synced measurements");
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

  describe("confirmSyncRun", () => {
    it("offers to upload only the run's unsynced measurements", async () => {
      mockGetMeasurementIdsByRunId.mockResolvedValue(["r1", "r3"]);
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      await act(async () => {
        await result.current.confirmSyncRun("run-1", "Run Exp");
      });

      expect(mockGetMeasurementIdsByRunId).toHaveBeenCalledWith("run-1", ["pending", "failed"]);
      expect(mockShowAlert).toHaveBeenCalledWith(
        "Upload Workbook Run",
        'Upload 2 unsynced from "Run Exp" run?',
        expect.any(Array),
      );
    });

    it("enqueues every unsynced key in one call and invalidates", async () => {
      mockGetMeasurementIdsByRunId.mockResolvedValue(["r1", "r3"]);
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      await act(async () => {
        await result.current.confirmSyncRun("run-1", "Run Exp");
      });
      const [confirmBtn] = mockShowAlert.mock.calls[0][2];
      await act(() => confirmBtn.onPress());

      expect(mockUploadMany).toHaveBeenCalledTimes(1);
      expect(mockUploadMany).toHaveBeenCalledWith(["r1", "r3"]);
      expect(mockInvalidate).toHaveBeenCalled();
    });

    it("acts on the whole run from storage, not the rendered slice", async () => {
      // Rows hidden by a status filter, a midnight day split, or an unfetched
      // page are still part of the run: the storage lookup returns them all.
      mockGetMeasurementIdsByRunId.mockResolvedValue(["r1", "r3", "r7", "r9"]);
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      await act(async () => {
        await result.current.confirmSyncRun("run-1", "Run Exp");
      });
      const [confirmBtn] = mockShowAlert.mock.calls[0][2];
      await act(() => confirmBtn.onPress());

      expect(mockUploadMany).toHaveBeenCalledWith(["r1", "r3", "r7", "r9"]);
    });

    it("does not prompt for a fully synced run", async () => {
      mockGetMeasurementIdsByRunId.mockResolvedValue([]);
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      await act(async () => {
        await result.current.confirmSyncRun("run-1", "Run Exp");
      });

      expect(mockShowAlert).not.toHaveBeenCalled();
    });

    it("re-resolves membership when the confirmation runs, not before it", async () => {
      // A member settles or is added while the alert is open: the action acts
      // on the lookup at execution time, not the pre-alert snapshot.
      mockGetMeasurementIdsByRunId
        .mockResolvedValueOnce(["r1"])
        .mockResolvedValueOnce(["r1", "r2"]);
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      await act(async () => {
        await result.current.confirmSyncRun("run-1", "Run Exp");
      });
      expect(mockShowAlert.mock.calls[0][1]).toContain("1");
      const [confirmBtn] = mockShowAlert.mock.calls[0][2];
      await act(() => confirmBtn.onPress());

      expect(mockUploadMany).toHaveBeenCalledWith(["r1", "r2"]);
    });

    it("invalidates instead of no-oping when the run has no unsynced members", async () => {
      mockGetMeasurementIdsByRunId.mockResolvedValue([]);
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      await act(async () => {
        await result.current.confirmSyncRun("run-1", "Run Exp");
      });

      expect(mockShowAlert).not.toHaveBeenCalled();
      expect(mockInvalidate).toHaveBeenCalled();
    });

    it("surfaces a membership lookup failure instead of prompting", async () => {
      mockGetMeasurementIdsByRunId.mockRejectedValue(new Error("db locked"));
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      await act(async () => {
        await result.current.confirmSyncRun("run-1", "Run Exp");
      });

      expect(mockShowAlert).not.toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledWith(
        "Failed to upload measurement. Please try again.",
      );
    });

    it("reports an upload failure and still invalidates", async () => {
      mockGetMeasurementIdsByRunId.mockResolvedValue(["r1", "r3"]);
      mockUploadMany.mockRejectedValueOnce(new Error("offline"));
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      await act(async () => {
        await result.current.confirmSyncRun("run-1", "Run Exp");
      });
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

  describe("confirmDeleteRun", () => {
    it("names the run and its size before deleting", async () => {
      mockGetMeasurementIdsByRunId.mockResolvedValue(["r1", "r2"]);
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      await act(async () => {
        await result.current.confirmDeleteRun("run-1", "Run Exp");
      });

      // No status filter for delete: every member of the run goes.
      expect(mockGetMeasurementIdsByRunId.mock.calls[0][0]).toBe("run-1");
      expect(mockShowAlert).toHaveBeenCalledWith(
        "Delete Workbook Run",
        'Delete 2 from "Run Exp" run?',
        expect.any(Array),
      );
    });

    it("confirms with the danger variant", async () => {
      mockGetMeasurementIdsByRunId.mockResolvedValue(["r1", "r2"]);
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      await act(async () => {
        await result.current.confirmDeleteRun("run-1", "Run Exp");
      });

      const [confirmBtn] = mockShowAlert.mock.calls[0][2];
      expect(confirmBtn.variant).toBe("danger");
    });

    it("deletes every measurement of the run in one call", async () => {
      mockGetMeasurementIdsByRunId.mockResolvedValue(["r1", "r2"]);
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      await act(async () => {
        await result.current.confirmDeleteRun("run-1", "Run Exp");
      });
      const [confirmBtn] = mockShowAlert.mock.calls[0][2];
      await act(() => confirmBtn.onPress());

      expect(mockRemoveMeasurements).toHaveBeenCalledWith(["r1", "r2"]);
      expect(mockInvalidate).toHaveBeenCalled();
    });

    it("deletes the whole run even when the list renders only a slice of it", async () => {
      // The visible page/filter may hold just one row of the run; storage
      // membership is what gets deleted.
      mockGetMeasurementIdsByRunId.mockResolvedValue(["r1", "r2", "r3", "r4"]);
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      await act(async () => {
        await result.current.confirmDeleteRun("run-1", "Run Exp");
      });

      expect(mockShowAlert).toHaveBeenCalledWith(
        "Delete Workbook Run",
        'Delete 4 from "Run Exp" run?',
        expect.any(Array),
      );
      const [confirmBtn] = mockShowAlert.mock.calls[0][2];
      await act(() => confirmBtn.onPress());
      expect(mockRemoveMeasurements).toHaveBeenCalledWith(["r1", "r2", "r3", "r4"]);
    });

    it("does nothing when the run has no members", async () => {
      mockGetMeasurementIdsByRunId.mockResolvedValue([]);
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      await act(async () => {
        await result.current.confirmDeleteRun("run-1", "Run Exp");
      });

      expect(mockShowAlert).not.toHaveBeenCalled();
    });

    it("surfaces a membership lookup failure instead of prompting", async () => {
      mockGetMeasurementIdsByRunId.mockRejectedValue(new Error("db locked"));
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      await act(async () => {
        await result.current.confirmDeleteRun("run-1", "Run Exp");
      });

      expect(mockShowAlert).not.toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledWith(
        "Failed to delete measurement. Please try again.",
      );
    });

    it("surfaces a failed deletion instead of reporting success, and still invalidates", async () => {
      mockGetMeasurementIdsByRunId.mockResolvedValue(["r1", "r2"]);
      mockRemoveMeasurements.mockRejectedValueOnce(new Error("db locked"));
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));

      await act(async () => {
        await result.current.confirmDeleteRun("run-1", "Run Exp");
      });
      const [confirmBtn] = mockShowAlert.mock.calls[0][2];
      await act(async () => {
        confirmBtn.onPress();
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockToastError).toHaveBeenCalledWith(
        "Failed to delete measurement. Please try again.",
      );
      expect(mockInvalidate).toHaveBeenCalled();
    });
  });

  describe("saveComment", () => {
    it("calls updateMeasurementComment and invalidates", async () => {
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));
      const stored = {
        id: "k1",
        status: "failed" as const,
        data: {
          topic: "t/t",
          measurementResult: {},
          metadata: {
            experimentName: "Exp",
            protocolName: "p",
            timestamp: "2026-01-01T10:00:00Z",
          },
        },
      };

      await act(() => result.current.saveComment(stored, "great result"));

      expect(mockUpdateMeasurementComment).toHaveBeenCalledWith("k1", stored.data, "great result");
      expect(mockInvalidate).toHaveBeenCalled();
    });

    it("toasts, rethrows (so the modal stays open) and still invalidates on failure", async () => {
      mockUpdateMeasurementComment.mockRejectedValueOnce(new Error("db locked"));
      const { result } = renderHook(() => useRecentMeasurementsActions("all"));
      const stored = {
        id: "k1",
        status: "failed" as const,
        data: {
          topic: "t/t",
          measurementResult: {},
          metadata: {
            experimentName: "Exp",
            protocolName: "p",
            timestamp: "2026-01-01T10:00:00Z",
          },
        },
      };

      await expect(result.current.saveComment(stored, "great result")).rejects.toThrow("db locked");

      expect(mockToastError).toHaveBeenCalledWith("Could not save the comment. Please try again.");
      expect(mockInvalidate).toHaveBeenCalled();
    });
  });
});
