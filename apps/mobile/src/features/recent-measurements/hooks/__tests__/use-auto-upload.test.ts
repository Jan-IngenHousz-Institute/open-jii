// @vitest-environment jsdom
import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { useAutoUpload } from "../use-auto-upload";

const {
  mockUploadAll,
  mockToastInfo,
  mockToastSuccess,
  mockToastError,
  mockResetUploadingMeasurements,
  mockInvalidateQueries,
} = vi.hoisted(() => ({
  mockUploadAll: vi.fn().mockResolvedValue(undefined),
  mockToastInfo: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockResetUploadingMeasurements: vi.fn().mockResolvedValue(undefined),
  mockInvalidateQueries: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

let mockFailedUploads: { key: string; data: unknown }[] = [];
let mockIsUploading = false;

vi.mock("~/features/recent-measurements/hooks/use-measurements", () => ({
  useMeasurements: () => ({
    failedUploads: mockFailedUploads,
    uploadAll: mockUploadAll,
    isUploading: mockIsUploading,
  }),
}));

vi.mock("sonner-native", () => ({
  toast: { info: mockToastInfo, success: mockToastSuccess, error: mockToastError },
}));

vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      const count = vars?.count as number | undefined;
      const map: Record<string, string> = {
        "recentMeasurements:toasts.uploadingMeasurements":
          count === 1
            ? `Uploading ${count} unsynced measurement…`
            : `Uploading ${count} unsynced measurements…`,
        "recentMeasurements:toasts.measurementsSynced":
          count === 1 ? `${count} measurement synced` : `${count} measurements synced`,
        "recentMeasurements:toasts.uploadFailed": "Upload failed. Please try again.",
      };
      return map[key] ?? key;
    },
  }),
}));

let capturedAppStateListener: ((state: string) => void) | null = null;
const mockAppStateRemove = vi.fn();

vi.mock("react-native", () => ({
  AppState: {
    addEventListener: (_event: string, listener: (state: string) => void) => {
      capturedAppStateListener = listener;
      return { remove: mockAppStateRemove };
    },
  },
}));

let capturedNetworkListener: ((state: { isInternetReachable: boolean | null }) => void) | null =
  null;
const mockNetworkRemove = vi.fn();
let mockNetworkState: { isInternetReachable: boolean | null } = { isInternetReachable: true };

vi.mock("~/shared/db/measurements-storage", () => ({
  resetUploadingMeasurements: mockResetUploadingMeasurements,
}));

vi.mock("expo-network", () => ({
  addNetworkStateListener: (listener: (state: { isInternetReachable: boolean | null }) => void) => {
    capturedNetworkListener = listener;
    return { remove: mockNetworkRemove };
  },
  // tryUpload's offline guard reads this — default to "online" so existing
  // tests behave as before; individual tests can mutate mockNetworkState.
  useNetworkState: () => mockNetworkState,
}));

describe("useAutoUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFailedUploads = [];
    mockIsUploading = false;
    capturedAppStateListener = null;
    capturedNetworkListener = null;
    mockNetworkState = { isInternetReachable: true };
  });

  // ---------------------------------------------------------------------------
  // initial load
  // ---------------------------------------------------------------------------

  describe("startup reset sequence", () => {
    it("calls invalidateQueries after reset so recovered rows are visible", async () => {
      renderHook(() => useAutoUpload());

      await waitFor(() =>
        expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["measurements"] }),
      );
      // Reset must complete before invalidate runs.
      const resetOrder = mockResetUploadingMeasurements.mock.invocationCallOrder[0];
      const invalidateOrder = mockInvalidateQueries.mock.invocationCallOrder[0];
      expect(resetOrder).toBeLessThan(invalidateOrder);
    });

    it("does not fire initial upload before reset completes", async () => {
      let resolveReset!: () => void;
      mockResetUploadingMeasurements.mockImplementationOnce(
        () =>
          new Promise<void>((res) => {
            resolveReset = res;
          }),
      );

      mockFailedUploads = [{ key: "k1", data: {} }];
      renderHook(() => useAutoUpload());

      // Reset is pending — uploadAll must not run yet even though failedUploads is non-empty.
      await new Promise((r) => setTimeout(r, 0));
      expect(mockUploadAll).not.toHaveBeenCalled();

      resolveReset();
      await waitFor(() => expect(mockUploadAll).toHaveBeenCalledOnce());
    });

    it("uses recovered rows for the first upload when reset reveals them", async () => {
      let resolveReset!: () => void;
      mockResetUploadingMeasurements.mockImplementationOnce(
        () =>
          new Promise<void>((res) => {
            resolveReset = res;
          }),
      );

      // Simulate query cache only exposing recovered rows after reset+invalidate.
      mockFailedUploads = [];
      const { rerender } = renderHook(() => useAutoUpload());

      await new Promise((r) => setTimeout(r, 0));
      expect(mockUploadAll).not.toHaveBeenCalled();

      resolveReset();
      await waitFor(() => expect(mockInvalidateQueries).toHaveBeenCalled());

      mockFailedUploads = [{ key: "recovered", data: {} }];
      rerender();

      await waitFor(() => expect(mockUploadAll).toHaveBeenCalledOnce());
    });
  });

  describe("initial load", () => {
    it("calls resetUploadingMeasurements on mount", () => {
      renderHook(() => useAutoUpload());

      expect(mockResetUploadingMeasurements).toHaveBeenCalledOnce();
    });

    it("triggers upload when failedUploads first becomes non-empty", async () => {
      mockFailedUploads = [{ key: "k1", data: {} }];
      renderHook(() => useAutoUpload());

      await waitFor(() => expect(mockUploadAll).toHaveBeenCalledOnce());
    });

    it("does not trigger when no unsynced measurements on load", () => {
      mockFailedUploads = [];
      renderHook(() => useAutoUpload());

      expect(mockUploadAll).not.toHaveBeenCalled();
    });

    it("does not trigger when already uploading", () => {
      mockFailedUploads = [{ key: "k1", data: {} }];
      mockIsUploading = true;
      renderHook(() => useAutoUpload());

      expect(mockUploadAll).not.toHaveBeenCalled();
    });

    it("only triggers once even when failedUploads changes again", async () => {
      mockFailedUploads = [{ key: "k1", data: {} }];
      const { rerender } = renderHook(() => useAutoUpload());

      await waitFor(() => expect(mockUploadAll).toHaveBeenCalledOnce());

      mockFailedUploads = [
        { key: "k1", data: {} },
        { key: "k2", data: {} },
      ];
      rerender();

      expect(mockUploadAll).toHaveBeenCalledOnce();
    });
  });

  // ---------------------------------------------------------------------------
  // toast messages
  // ---------------------------------------------------------------------------

  describe("toast messages", () => {
    it("does not show start/success toasts for the happy path", async () => {
      mockFailedUploads = [{ key: "k1", data: {} }];
      renderHook(() => useAutoUpload());

      await waitFor(() => expect(mockUploadAll).toHaveBeenCalled());
      expect(mockToastInfo).not.toHaveBeenCalled();
      expect(mockToastSuccess).not.toHaveBeenCalled();
    });

    it("shows error toast when upload fails", async () => {
      mockFailedUploads = [{ key: "k1", data: {} }];
      mockUploadAll.mockRejectedValueOnce(new Error("network error"));
      renderHook(() => useAutoUpload());

      await waitFor(() => expect(mockToastError).toHaveBeenCalled());
      expect(mockToastError).toHaveBeenCalledWith("Upload failed. Please try again.");
      expect(mockToastSuccess).not.toHaveBeenCalled();
      expect(mockToastInfo).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // AppState foreground trigger
  // ---------------------------------------------------------------------------

  describe("AppState foreground trigger", () => {
    it("registers an AppState listener on mount", () => {
      renderHook(() => useAutoUpload());

      expect(capturedAppStateListener).not.toBeNull();
    });

    it("triggers upload when app becomes active with unsynced measurements", async () => {
      mockFailedUploads = [{ key: "k1", data: {} }];
      renderHook(() => useAutoUpload());

      await waitFor(() => expect(mockUploadAll).toHaveBeenCalledOnce());
      mockUploadAll.mockClear();

      act(() => capturedAppStateListener?.("active"));

      await waitFor(() => expect(mockUploadAll).toHaveBeenCalledOnce());
    });

    it("does not trigger upload on background state change", () => {
      mockFailedUploads = [];
      renderHook(() => useAutoUpload());

      act(() => capturedAppStateListener?.("background"));

      expect(mockUploadAll).not.toHaveBeenCalled();
    });

    it("skips upload on foreground when no unsynced measurements", () => {
      mockFailedUploads = [];
      renderHook(() => useAutoUpload());

      act(() => capturedAppStateListener?.("active"));

      expect(mockUploadAll).not.toHaveBeenCalled();
    });

    it("skips upload on foreground when already uploading", () => {
      mockIsUploading = true;
      mockFailedUploads = [{ key: "k1", data: {} }];
      renderHook(() => useAutoUpload());

      act(() => capturedAppStateListener?.("active"));

      expect(mockUploadAll).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // cleanup
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // network reconnection trigger
  // ---------------------------------------------------------------------------

  describe("network reconnection trigger", () => {
    it("registers a network state listener on mount", () => {
      renderHook(() => useAutoUpload());

      expect(capturedNetworkListener).not.toBeNull();
    });

    it("triggers upload when connection is restored (false → true)", async () => {
      mockFailedUploads = [{ key: "k1", data: {} }];
      renderHook(() => useAutoUpload());

      await waitFor(() => expect(mockUploadAll).toHaveBeenCalledOnce());
      mockUploadAll.mockClear();

      act(() => capturedNetworkListener?.({ isInternetReachable: false }));
      act(() => capturedNetworkListener?.({ isInternetReachable: true }));

      await waitFor(() => expect(mockUploadAll).toHaveBeenCalledOnce());
    });

    it("does not trigger when connection was already reachable", async () => {
      mockFailedUploads = [{ key: "k1", data: {} }];
      renderHook(() => useAutoUpload());

      await waitFor(() => expect(mockUploadAll).toHaveBeenCalledOnce());
      mockUploadAll.mockClear();

      act(() => capturedNetworkListener?.({ isInternetReachable: true }));
      act(() => capturedNetworkListener?.({ isInternetReachable: true }));

      expect(mockUploadAll).not.toHaveBeenCalled();
    });

    it("does not trigger when connection drops (true → false)", async () => {
      mockFailedUploads = [{ key: "k1", data: {} }];
      renderHook(() => useAutoUpload());

      await waitFor(() => expect(mockUploadAll).toHaveBeenCalledOnce());
      mockUploadAll.mockClear();

      act(() => capturedNetworkListener?.({ isInternetReachable: true }));
      act(() => capturedNetworkListener?.({ isInternetReachable: false }));

      expect(mockUploadAll).not.toHaveBeenCalled();
    });

    it("does not trigger on restore when no unsynced measurements", () => {
      mockFailedUploads = [];
      renderHook(() => useAutoUpload());

      act(() => capturedNetworkListener?.({ isInternetReachable: false }));
      act(() => capturedNetworkListener?.({ isInternetReachable: true }));

      expect(mockUploadAll).not.toHaveBeenCalled();
    });

    it("does not trigger on restore when already uploading", () => {
      mockIsUploading = true;
      mockFailedUploads = [{ key: "k1", data: {} }];
      renderHook(() => useAutoUpload());

      act(() => capturedNetworkListener?.({ isInternetReachable: false }));
      act(() => capturedNetworkListener?.({ isInternetReachable: true }));

      expect(mockUploadAll).not.toHaveBeenCalled();
    });

    it("triggers upload when null event is received between offline and online (false → null → true)", async () => {
      mockFailedUploads = [{ key: "k1", data: {} }];
      renderHook(() => useAutoUpload());

      await waitFor(() => expect(mockUploadAll).toHaveBeenCalledOnce());
      mockUploadAll.mockClear();

      act(() => capturedNetworkListener?.({ isInternetReachable: false }));
      act(() => capturedNetworkListener?.({ isInternetReachable: null }));
      act(() => capturedNetworkListener?.({ isInternetReachable: true }));

      await waitFor(() => expect(mockUploadAll).toHaveBeenCalledOnce());
    });

    it("does not treat null → true as a restore when no prior offline state", async () => {
      mockFailedUploads = [{ key: "k1", data: {} }];
      renderHook(() => useAutoUpload());

      await waitFor(() => expect(mockUploadAll).toHaveBeenCalledOnce());
      mockUploadAll.mockClear();

      act(() => capturedNetworkListener?.({ isInternetReachable: null }));
      act(() => capturedNetworkListener?.({ isInternetReachable: true }));

      expect(mockUploadAll).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // concurrent upload guard (autoUploadInFlight)
  // ---------------------------------------------------------------------------

  describe("concurrent upload guard", () => {
    it("drops a second call while first upload is still in flight", async () => {
      let resolveUpload!: () => void;
      mockUploadAll.mockImplementationOnce(
        () =>
          new Promise<void>((res) => {
            resolveUpload = res;
          }),
      );

      mockFailedUploads = [{ key: "k1", data: {} }];
      renderHook(() => useAutoUpload());

      await waitFor(() => expect(mockUploadAll).toHaveBeenCalledOnce());

      act(() => capturedAppStateListener?.("active"));
      expect(mockUploadAll).toHaveBeenCalledOnce();

      resolveUpload();
      await act(() => Promise.resolve());
    });

    it("resets inFlight ref after success so next call can proceed", async () => {
      mockFailedUploads = [{ key: "k1", data: {} }];
      renderHook(() => useAutoUpload());

      await waitFor(() => expect(mockUploadAll).toHaveBeenCalledOnce());
      mockUploadAll.mockClear();

      act(() => capturedAppStateListener?.("active"));
      await waitFor(() => expect(mockUploadAll).toHaveBeenCalledOnce());
    });

    it("resets inFlight ref after failure so next call can proceed", async () => {
      mockUploadAll.mockRejectedValueOnce(new Error("network error"));
      mockFailedUploads = [{ key: "k1", data: {} }];
      renderHook(() => useAutoUpload());

      await waitFor(() => expect(mockToastError).toHaveBeenCalled());
      mockUploadAll.mockClear();

      act(() => capturedAppStateListener?.("active"));
      await waitFor(() => expect(mockUploadAll).toHaveBeenCalledOnce());
    });
  });

  // ---------------------------------------------------------------------------
  // cleanup
  // ---------------------------------------------------------------------------

  describe("cleanup", () => {
    it("removes AppState listener on unmount", () => {
      const { unmount } = renderHook(() => useAutoUpload());
      unmount();

      expect(mockAppStateRemove).toHaveBeenCalledOnce();
    });

    it("removes network listener on unmount", () => {
      const { unmount } = renderHook(() => useAutoUpload());
      unmount();

      expect(mockNetworkRemove).toHaveBeenCalledOnce();
    });
  });
});
