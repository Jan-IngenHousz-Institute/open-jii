import { render, screen } from "@testing-library/react-native";
import React from "react";
import { View } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QRScannerModal } from "./qr-scanner-modal";

interface ScannerTestState {
  granted: boolean;
  onBarcodeScanned?: (result: { data: string }) => void;
}

const state = vi.hoisted<ScannerTestState>(() => ({ granted: true, onBarcodeScanned: undefined }));

vi.mock("expo-camera", () => ({
  CameraView: (props: { onBarcodeScanned?: (result: { data: string }) => void }) => {
    state.onBarcodeScanned = props.onBarcodeScanned;
    return React.createElement(View, { testID: "camera-view" });
  },
  useCameraPermissions: () => [{ granted: state.granted }, vi.fn()],
}));

vi.mock("./camera-permission-state", () => ({
  useCameraPermission: () => [{ granted: state.granted }, vi.fn()],
  CameraPermissionState: () => React.createElement(View, { testID: "permission-state" }),
}));

vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "common:qrScanner.alignPrompt": "Align a QR code within the frame",
        "common:qrScanner.matchNote":
          "The QR code must match exactly one of the available options.",
      })[key] ?? key,
  }),
}));

const onScanned = vi.fn();
const onClose = vi.fn();

beforeEach(() => {
  state.granted = true;
  state.onBarcodeScanned = undefined;
  onScanned.mockClear();
  onClose.mockClear();
});

describe("QRScannerModal", () => {
  it("shows the permission state instead of the camera until access is granted", () => {
    state.granted = false;

    render(<QRScannerModal visible onClose={onClose} onScanned={onScanned} />);

    expect(screen.getByTestId("permission-state")).toBeTruthy();
    expect(screen.queryByTestId("camera-view")).toBeNull();
  });

  it("opens the camera with the align prompt once access is granted", () => {
    render(<QRScannerModal visible onClose={onClose} onScanned={onScanned} />);

    expect(screen.getByTestId("camera-view")).toBeTruthy();
    expect(screen.getByText("Align a QR code within the frame")).toBeTruthy();
  });

  it("reports a scan once and closes, ignoring a second fire in the same cycle", () => {
    render(<QRScannerModal visible onClose={onClose} onScanned={onScanned} />);

    state.onBarcodeScanned?.({ data: "https://openjii.test/en-US/join/KP7Q-4WMX" });
    state.onBarcodeScanned?.({ data: "https://openjii.test/en-US/join/AAAA-BBBB" });

    expect(onScanned).toHaveBeenCalledOnce();
    expect(onScanned).toHaveBeenCalledWith("https://openjii.test/en-US/join/KP7Q-4WMX");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("scans again after the modal is reopened", () => {
    const { rerender } = render(<QRScannerModal visible onClose={onClose} onScanned={onScanned} />);

    state.onBarcodeScanned?.({ data: "first" });
    rerender(<QRScannerModal visible={false} onClose={onClose} onScanned={onScanned} />);
    rerender(<QRScannerModal visible onClose={onClose} onScanned={onScanned} />);
    state.onBarcodeScanned?.({ data: "second" });

    expect(onScanned).toHaveBeenNthCalledWith(1, "first");
    expect(onScanned).toHaveBeenNthCalledWith(2, "second");
  });

  it("shows the match note only when the caller asks for it", () => {
    const { rerender } = render(<QRScannerModal visible onClose={onClose} onScanned={onScanned} />);

    expect(
      screen.queryByText("The QR code must match exactly one of the available options."),
    ).toBeNull();

    rerender(<QRScannerModal visible showMatchNote onClose={onClose} onScanned={onScanned} />);

    expect(
      screen.getByText("The QR code must match exactly one of the available options."),
    ).toBeTruthy();
  });
});
