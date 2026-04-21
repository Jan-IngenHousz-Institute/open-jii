// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const {
  mockUploadAll,
  mockToastInfo,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockUploadAll: vi.fn().mockResolvedValue(undefined),
  mockToastInfo: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

let mockFailedUploads: { key: string; data: unknown }[] = [];
let mockIsUploading = false;

vi.mock("~/hooks/use-measurements", () => ({
  useMeasurements: () => ({
    failedUploads: mockFailedUploads,
    uploadAll: mockUploadAll,
    isUploading: mockIsUploading,
  }),
}));

vi.mock("sonner-native", () => ({
  toast: { info: mockToastInfo, success: mockToastSuccess, error: mockToastError },
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

vi.mock("expo-network", () => ({
  addNetworkStateListener: (
    listener: (state: { isInternetReachable: boolean | null }) => void,
  ) => {
    capturedNetworkListener = listener;
    return { remove: mockNetworkRemove };
  },
}));

import { useAutoUpload } from "../use-auto-upload";

describe("useAutoUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFailedUploads = [];
    mockIsUploading = false;
    capturedAppStateListener = null;
    capturedNetworkListener = null;
  });

  // ---------------------------------------------------------------------------
  // initial load
  // ---------------------------------------------------------------------------

  describe("initial load", () => {
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

      mockFailedUploads = [{ key: "k1", data: {} }, { key: "k2", data: {} }];
      rerender();

      expect(mockUploadAll).toHaveBeenCalledOnce();
    });
  });

  // ---------------------------------------------------------------------------
  // toast messages
  // ---------------------------------------------------------------------------

  describe("toast messages", () => {
    it("shows info toast and success toast for 1 measurement", async () => {
      mockFailedUploads = [{ key: "k1", data: {} }];
      renderHook(() => useAutoUpload());

      await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
      expect(mockToastInfo).toHaveBeenCalledWith("Uploading 1 unsynced measurement…");
      expect(mockToastSuccess).toHaveBeenCalledWith("1 measurement synced");
    });

    it("uses plural form for multiple measurements", async () => {
      mockFailedUploads = [{ key: "k1", data: {} }, { key: "k2", data: {} }];
      renderHook(() => useAutoUpload());

      await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
      expect(mockToastInfo).toHaveBeenCalledWith("Uploading 2 unsynced measurements…");
      expect(mockToastSuccess).toHaveBeenCalledWith("2 measurements synced");
    });

    it("shows error toast when upload fails", async () => {
      mockFailedUploads = [{ key: "k1", data: {} }];
      mockUploadAll.mockRejectedValueOnce(new Error("network error"));
      renderHook(() => useAutoUpload());

      await waitFor(() => expect(mockToastError).toHaveBeenCalled());
      expect(mockToastError).toHaveBeenCalledWith("Upload failed. Please try again.");
      expect(mockToastSuccess).not.toHaveBeenCalled();
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

      act(() => capturedAppStateListener!("active"));

      await waitFor(() => expect(mockUploadAll).toHaveBeenCalledOnce());
    });

    it("does not trigger upload on background state change", () => {
      mockFailedUploads = [];
      renderHook(() => useAutoUpload());

      act(() => capturedAppStateListener!("background"));

      expect(mockUploadAll).not.toHaveBeenCalled();
    });

    it("skips upload on foreground when no unsynced measurements", () => {
      mockFailedUploads = [];
      renderHook(() => useAutoUpload());

      act(() => capturedAppStateListener!("active"));

      expect(mockUploadAll).not.toHaveBeenCalled();
    });

    it("skips upload on foreground when already uploading", () => {
      mockIsUploading = true;
      mockFailedUploads = [{ key: "k1", data: {} }];
      renderHook(() => useAutoUpload());

      act(() => capturedAppStateListener!("active"));

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

      act(() => capturedNetworkListener!({ isInternetReachable: false }));
      act(() => capturedNetworkListener!({ isInternetReachable: true }));

      await waitFor(() => expect(mockUploadAll).toHaveBeenCalledOnce());
    });

    it("does not trigger when connection was already reachable", async () => {
      mockFailedUploads = [{ key: "k1", data: {} }];
      renderHook(() => useAutoUpload());

      await waitFor(() => expect(mockUploadAll).toHaveBeenCalledOnce());
      mockUploadAll.mockClear();

      act(() => capturedNetworkListener!({ isInternetReachable: true }));
      act(() => capturedNetworkListener!({ isInternetReachable: true }));

      expect(mockUploadAll).not.toHaveBeenCalled();
    });

    it("does not trigger when connection drops (true → false)", async () => {
      mockFailedUploads = [{ key: "k1", data: {} }];
      renderHook(() => useAutoUpload());

      await waitFor(() => expect(mockUploadAll).toHaveBeenCalledOnce());
      mockUploadAll.mockClear();

      act(() => capturedNetworkListener!({ isInternetReachable: true }));
      act(() => capturedNetworkListener!({ isInternetReachable: false }));

      expect(mockUploadAll).not.toHaveBeenCalled();
    });

    it("does not trigger on restore when no unsynced measurements", () => {
      mockFailedUploads = [];
      renderHook(() => useAutoUpload());

      act(() => capturedNetworkListener!({ isInternetReachable: false }));
      act(() => capturedNetworkListener!({ isInternetReachable: true }));

      expect(mockUploadAll).not.toHaveBeenCalled();
    });

    it("does not trigger on restore when already uploading", () => {
      mockIsUploading = true;
      mockFailedUploads = [{ key: "k1", data: {} }];
      renderHook(() => useAutoUpload());

      act(() => capturedNetworkListener!({ isInternetReachable: false }));
      act(() => capturedNetworkListener!({ isInternetReachable: true }));

      expect(mockUploadAll).not.toHaveBeenCalled();
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
