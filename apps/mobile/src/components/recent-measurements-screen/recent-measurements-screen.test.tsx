import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import React from "react";
import { TouchableOpacity, ActivityIndicator } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MeasurementItem } from "~/hooks/use-all-measurements";

import { RecentMeasurementsScreen } from "./recent-measurements-screen";

vi.mock("react-native-gesture-handler", () => {
  const GestureDetector = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  const Gesture = {
    Pan: () => ({
      activeOffsetX: () => Gesture.Pan(),
      failOffsetY: () => Gesture.Pan(),
      onStart: () => Gesture.Pan(),
      onUpdate: () => Gesture.Pan(),
      onEnd: () => Gesture.Pan(),
    }),
  };
  return { __esModule: true, GestureDetector, Gesture };
});

const {
  showAlert,
  uploadAll,
  clearSyncedMeasurements,
  useMeasurements,
  useAllMeasurements,
  exportMeasurementsToFile,
  toast,
} = vi.hoisted(() => ({
  showAlert: vi.fn(),
  uploadAll: vi.fn(),
  clearSyncedMeasurements: vi.fn(),
  useMeasurements: vi.fn(),
  useAllMeasurements: vi.fn(),
  exportMeasurementsToFile: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("~/components/AlertDialog", () => ({
  showAlert: (...args: unknown[]) => showAlert(...args),
}));
vi.mock("~/hooks/use-measurements", () => ({
  useMeasurements: () => useMeasurements(),
}));
vi.mock("~/hooks/use-all-measurements", () => ({
  useAllMeasurements: () => useAllMeasurements(),
}));
vi.mock("~/services/export-measurements", () => ({
  exportMeasurementsToFile: () => exportMeasurementsToFile(),
}));
vi.mock("sonner-native", () => ({ toast }));

const makeMeasurement = (key: string, status: "synced" | "unsynced"): MeasurementItem => ({
  key,
  timestamp: "2026-04-20T10:00:00.000Z",
  experimentName: `Experiment ${key}`,
  status,
  data: {
    topic: "test/topic",
    measurementResult: {},
    metadata: {
      experimentName: `Experiment ${key}`,
      protocolName: "Protocol A",
      timestamp: "2026-04-20T10:00:00.000Z",
    },
  },
});

const invalidate = vi.fn();

beforeEach(() => {
  uploadAll.mockReset();
  clearSyncedMeasurements.mockReset();
  showAlert.mockReset();
  invalidate.mockReset();
  exportMeasurementsToFile.mockReset();
  exportMeasurementsToFile.mockResolvedValue(undefined);
  toast.error.mockReset();
  toast.success.mockReset();
  useMeasurements.mockReturnValue({
    uploadAll,
    isUploading: false,
    clearSyncedMeasurements,
    uploadOne: vi.fn(),
    removeMeasurement: vi.fn(),
    updateMeasurementComment: vi.fn(),
  });
  useAllMeasurements.mockReturnValue({ measurements: [], invalidate });
});

describe("RecentMeasurementsScreen", () => {
  it("renders all three filter tabs", () => {
    render(<RecentMeasurementsScreen />);
    expect(screen.getByText("All")).toBeTruthy();
    expect(screen.getByText("Synced")).toBeTruthy();
    expect(screen.getByText("Unsynced")).toBeTruthy();
  });

  it("opens the upload-all alert when the sync button is pressed", () => {
    useAllMeasurements.mockReturnValue({
      measurements: [makeMeasurement("m1", "unsynced")],
      invalidate,
    });
    render(<RecentMeasurementsScreen />);

    const touchables = screen.UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(touchables[4]); // Upload icon (header)
    expect(showAlert).toHaveBeenCalledWith(
      "Upload All Measurements",
      expect.stringContaining("1 unsynced measurement"),
      expect.any(Array),
    );
  });

  it("calls uploadAll and shows success toast after confirming sync-all", async () => {
    useAllMeasurements.mockReturnValue({
      measurements: [makeMeasurement("m1", "unsynced")],
      invalidate,
    });
    showAlert.mockImplementation((_title, _msg, buttons) => {
      buttons?.[0]?.onPress?.();
    });
    uploadAll.mockResolvedValueOnce(undefined);

    render(<RecentMeasurementsScreen />);
    const touchables = screen.UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(touchables[4]); // Upload icon (header)

    await waitFor(() => expect(uploadAll).toHaveBeenCalled());
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
  });

  it("opens the delete-synced alert when the trash button is pressed", () => {
    useAllMeasurements.mockReturnValue({
      measurements: [makeMeasurement("m2", "synced")],
      invalidate,
    });
    render(<RecentMeasurementsScreen />);

    const touchables = screen.UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(touchables[3]); // Trash icon (header)
    expect(showAlert).toHaveBeenCalledWith(
      "Delete all synced measurements",
      expect.stringContaining("1 synced measurement"),
      expect.any(Array),
    );
  });

  it("calls clearSyncedMeasurements and invalidate after confirming delete-synced", async () => {
    useAllMeasurements.mockReturnValue({
      measurements: [makeMeasurement("m2", "synced")],
      invalidate,
    });
    showAlert.mockImplementation((_title, _msg, buttons) => {
      buttons?.[0]?.onPress?.();
    });
    clearSyncedMeasurements.mockResolvedValueOnce(undefined);

    render(<RecentMeasurementsScreen />);
    const touchables = screen.UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(touchables[3]); // Trash icon (header)

    await waitFor(() => expect(clearSyncedMeasurements).toHaveBeenCalled());
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
  });

  it("calls exportMeasurementsToFile when the export button is pressed", () => {
    // The export button is in the FlatList footer, only rendered when measurements is non-empty
    useAllMeasurements.mockReturnValue({
      measurements: [makeMeasurement("m1", "synced")],
      invalidate,
    });
    render(<RecentMeasurementsScreen />);
    fireEvent.press(screen.getByText("Export measurements"));
    expect(exportMeasurementsToFile).toHaveBeenCalled();
  });

  it("shows a loading indicator on the upload button while uploading", () => {
    useMeasurements.mockReturnValue({
      uploadAll,
      isUploading: true,
      clearSyncedMeasurements,
      uploadOne: vi.fn(),
      removeMeasurement: vi.fn(),
      updateMeasurementComment: vi.fn(),
    });
    useAllMeasurements.mockReturnValue({
      measurements: [makeMeasurement("m1", "unsynced")],
      invalidate,
    });
    render(<RecentMeasurementsScreen />);
    // Button component renders an ActivityIndicator instead of the icon when isLoading is true.
    expect(screen.UNSAFE_getAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  });

  it("shows error toast when uploadAll fails", async () => {
    useAllMeasurements.mockReturnValue({
      measurements: [makeMeasurement("m1", "unsynced")],
      invalidate,
    });
    showAlert.mockImplementation((_title, _msg, buttons) => {
      buttons?.[0]?.onPress?.();
    });
    uploadAll.mockRejectedValueOnce(new Error("fail"));

    render(<RecentMeasurementsScreen />);
    const touchables = screen.UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(touchables[4]);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Sync failed. Please try again."));
  });

  it("shows error toast when clearSyncedMeasurements fails", async () => {
    useAllMeasurements.mockReturnValue({
      measurements: [makeMeasurement("m2", "synced")],
      invalidate,
    });
    showAlert.mockImplementation((_title, _msg, buttons) => {
      buttons?.[0]?.onPress?.();
    });
    clearSyncedMeasurements.mockRejectedValueOnce(new Error("fail"));

    render(<RecentMeasurementsScreen />);
    const touchables = screen.UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(touchables[3]);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Failed to delete synced measurements"),
    );
  });

  it("shows error toast when export fails", async () => {
    useAllMeasurements.mockReturnValue({
      measurements: [makeMeasurement("m1", "synced")],
      invalidate,
    });
    exportMeasurementsToFile.mockRejectedValueOnce(new Error("fail"));

    render(<RecentMeasurementsScreen />);
    fireEvent.press(screen.getByText("Export measurements"));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Export failed. Please try again."),
    );
  });
});
