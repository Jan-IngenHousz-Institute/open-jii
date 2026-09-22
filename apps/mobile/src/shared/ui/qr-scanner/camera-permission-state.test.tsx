import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { ActivityIndicator, Linking } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CameraPermissionState } from "./camera-permission-state";

vi.mock("expo-camera", () => ({ useCameraPermissions: () => [null, vi.fn()] }));

vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "common:cameraPermission.deniedTitle": "Permission disabled",
        "common:cameraPermission.requiredTitle": "Camera access required",
        "common:cameraPermission.deniedMessage": "Camera access has been permanently denied.",
        "common:cameraPermission.requiredMessage": "openJII needs access to your camera.",
        "common:cameraPermission.grant": "Grant permission",
        "common:cameraPermission.openSettings": "Open settings",
      })[key] ?? key,
  }),
}));

const requestPermission = vi.fn();

beforeEach(() => {
  requestPermission.mockClear();
  vi.restoreAllMocks();
});

describe("CameraPermissionState", () => {
  it("spins while the permission has not been read yet", () => {
    const { UNSAFE_queryAllByType } = render(
      <CameraPermissionState permission={null} requestPermission={requestPermission} />,
    );

    expect(UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(1);
    expect(screen.queryByText("Camera access required")).toBeNull();
  });

  it("asks for the permission the first time, and requests it on tap", () => {
    render(
      <CameraPermissionState
        permission={{ granted: false, canAskAgain: true, status: "undetermined" } as never}
        requestPermission={requestPermission}
      />,
    );

    expect(screen.getByText("Camera access required")).toBeTruthy();
    expect(screen.queryByText("Open settings")).toBeNull();

    fireEvent.press(screen.getByText("Grant permission"));
    expect(requestPermission).toHaveBeenCalledOnce();
  });

  it("sends a permanently denied user to the system settings instead of re-asking", () => {
    const openSettings = vi.spyOn(Linking, "openSettings").mockImplementation(() => {
      return Promise.resolve();
    });

    render(
      <CameraPermissionState
        permission={{ granted: false, canAskAgain: false, status: "denied" } as never}
        requestPermission={requestPermission}
      />,
    );

    expect(screen.getByText("Permission disabled")).toBeTruthy();
    expect(screen.queryByText("Grant permission")).toBeNull();

    fireEvent.press(screen.getByText("Open settings"));
    expect(openSettings).toHaveBeenCalledOnce();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("treats a denied status as permanent even while the OS still allows asking", () => {
    render(
      <CameraPermissionState
        permission={{ granted: false, canAskAgain: true, status: "denied" } as never}
        requestPermission={requestPermission}
      />,
    );

    expect(screen.getByText("Permission disabled")).toBeTruthy();
  });
});
