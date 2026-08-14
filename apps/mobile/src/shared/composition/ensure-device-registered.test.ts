import { ORPCError } from "@orpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDeviceIdentityStore } from "~/shared/stores/device-identity-store";

import { ensureDeviceRegistered } from "./ensure-device-registered";

const mockEnsureMobileDevice = vi.fn();

vi.mock("~/shared/api/client", () => ({
  getApiClient: () => ({ iot: { ensureMobileDevice: mockEnsureMobileDevice } }),
}));

vi.mock("expo-device", () => ({ modelName: "iPhone 15" }));

vi.mock("~/shared/stores/environment-store", () => ({
  getEnvName: () => "dev",
}));

function identity() {
  return useDeviceIdentityStore.getState().identities.dev;
}

beforeEach(() => {
  mockEnsureMobileDevice.mockReset();
  useDeviceIdentityStore.setState({ identities: {}, isLoaded: true });
});

describe("ensureDeviceRegistered", () => {
  it("registers with the minted install id and persists the server identity", async () => {
    mockEnsureMobileDevice.mockResolvedValue({ id: "row-1", thingName: "mobile_abc" });

    await ensureDeviceRegistered();

    expect(mockEnsureMobileDevice).toHaveBeenCalledWith({
      installId: identity().installId,
      name: "iPhone 15",
    });
    expect(identity().thingName).toBe("mobile_abc");
    expect(identity().deviceId).toBe("row-1");
  });

  it("shares one in-flight run between concurrent triggers", async () => {
    mockEnsureMobileDevice.mockResolvedValue({ id: "row-1", thingName: "mobile_abc" });

    await Promise.all([ensureDeviceRegistered(), ensureDeviceRegistered()]);

    expect(mockEnsureMobileDevice).toHaveBeenCalledTimes(1);
  });

  it("treats an ownership conflict as registered and keeps the local identity", async () => {
    mockEnsureMobileDevice.mockRejectedValue(new ORPCError("CONFLICT", { status: 409 }));

    await ensureDeviceRegistered();

    // The shared phone keeps its stable, locally derived thing name.
    expect(identity().thingName).toBeUndefined();
    expect(identity().installId).toBeDefined();
  });

  it("skips silently while the device registry flag is off", async () => {
    mockEnsureMobileDevice.mockRejectedValue(new ORPCError("FORBIDDEN", { status: 403 }));

    await expect(ensureDeviceRegistered()).resolves.toBeUndefined();
  });

  it("swallows network failures and stays retryable", async () => {
    mockEnsureMobileDevice.mockRejectedValue(new Error("offline"));

    await ensureDeviceRegistered();
    mockEnsureMobileDevice.mockResolvedValue({ id: "row-1", thingName: "mobile_abc" });
    await ensureDeviceRegistered();

    expect(identity().thingName).toBe("mobile_abc");
  });
});
