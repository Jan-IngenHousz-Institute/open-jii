import { beforeEach, describe, expect, it, vi } from "vitest";

import { getClientMetadata } from "./client-metadata";

const { platform, device } = vi.hoisted(() => ({
  platform: { OS: "android" },
  device: {
    modelName: "SM-A165F",
    manufacturer: "samsung",
    osName: "samsung/a16nseea/a16:16/build:user/release-keys",
    osVersion: "16",
  },
}));

vi.mock("react-native", () => ({ Platform: platform }));
vi.mock("expo-device", () => device);
vi.mock("expo-application", () => ({ nativeApplicationVersion: "2.65.0" }));

beforeEach(() => {
  platform.OS = "android";
  device.osName = "samsung/a16nseea/a16:16/build:user/release-keys";
});

describe("getClientMetadata", () => {
  it("reports Android when Expo's osName is a build fingerprint", () => {
    expect(getClientMetadata()).toEqual({
      client_model: "SM-A165F",
      client_manufacturer: "samsung",
      client_os: "Android",
      client_os_version: "16",
      client_app_version: "2.65.0",
    });
  });

  it("preserves Expo's iPadOS name on iOS", () => {
    platform.OS = "ios";
    device.osName = "iPadOS";

    expect(getClientMetadata().client_os).toBe("iPadOS");
  });
});
