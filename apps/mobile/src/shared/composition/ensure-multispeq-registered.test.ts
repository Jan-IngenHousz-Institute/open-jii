import { ORPCError } from "@orpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DeviceIdentity } from "@repo/iot";

import {
  ensureMultispeqRegistered,
  resetMultispeqRegistrations,
} from "./ensure-multispeq-registered";

const mockEnsureMultispeqDevice = vi.fn();

vi.mock("~/shared/api/client", () => ({
  getApiClient: () => ({ iot: { ensureMultispeqDevice: mockEnsureMultispeqDevice } }),
}));

let currentEnv = "dev";
vi.mock("~/shared/stores/environment-store", () => ({
  getEnvName: () => currentEnv,
}));

function multispeq(overrides: Partial<DeviceIdentity> = {}): DeviceIdentity {
  return {
    family: "multispeq",
    deviceId: "03:25:05:25",
    name: "MultispeQ",
    firmwareVersion: "2.345",
    raw: {},
    ...overrides,
  };
}

beforeEach(() => {
  currentEnv = "dev";
  resetMultispeqRegistrations();
  mockEnsureMultispeqDevice.mockReset();
  mockEnsureMultispeqDevice.mockResolvedValue({ outcome: "created", device: null });
});

describe("ensureMultispeqRegistered", () => {
  it("registers the physical unit with its identity, firmware and name", async () => {
    await ensureMultispeqRegistered(multispeq());

    expect(mockEnsureMultispeqDevice).toHaveBeenCalledWith({
      serialNumber: "03:25:05:25",
      firmwareVersion: "2.345",
      name: "MultispeQ",
    });
  });

  it("sends the canonical lowercase form", async () => {
    await ensureMultispeqRegistered(multispeq({ deviceId: "AB:CD:EF:01" }));

    expect(mockEnsureMultispeqDevice).toHaveBeenCalledWith(
      expect.objectContaining({ serialNumber: "ab:cd:ef:01" }),
    );
  });

  it.each([
    ["another family", multispeq({ family: "ambit", deviceId: "10:91:A8:4F:53:48" })],
    ["a missing identity", multispeq({ deviceId: undefined })],
    ["the mock device", multispeq({ deviceId: "mock-1" })],
    ["a six-byte address", multispeq({ deviceId: "00:11:22:33:44:55" })],
  ])("skips %s", async (_label, identity) => {
    await ensureMultispeqRegistered(identity);

    expect(mockEnsureMultispeqDevice).not.toHaveBeenCalled();
  });

  it("leaves out a firmware string the registry cannot store", async () => {
    await ensureMultispeqRegistered(multispeq({ firmwareVersion: "v 2 beta!" }));

    expect(mockEnsureMultispeqDevice.mock.calls[0][0]).not.toHaveProperty("firmwareVersion");
  });

  it("asks once per unit and environment while the app runs", async () => {
    await ensureMultispeqRegistered(multispeq());
    await ensureMultispeqRegistered(multispeq());
    currentEnv = "prod";
    await ensureMultispeqRegistered(multispeq());

    expect(mockEnsureMultispeqDevice).toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight call between concurrent connections", async () => {
    await Promise.all([
      ensureMultispeqRegistered(multispeq()),
      ensureMultispeqRegistered(multispeq()),
    ]);

    expect(mockEnsureMultispeqDevice).toHaveBeenCalledTimes(1);
  });

  it("treats a refused identity as settled and does not ask again", async () => {
    mockEnsureMultispeqDevice.mockRejectedValue(new ORPCError("CONFLICT", { status: 409 }));

    await ensureMultispeqRegistered(multispeq());
    await ensureMultispeqRegistered(multispeq());

    expect(mockEnsureMultispeqDevice).toHaveBeenCalledTimes(1);
  });

  it("retries on the next connection after a transient failure, never throwing", async () => {
    mockEnsureMultispeqDevice.mockRejectedValueOnce(new Error("offline"));

    await expect(ensureMultispeqRegistered(multispeq())).resolves.toBeUndefined();
    await ensureMultispeqRegistered(multispeq());

    expect(mockEnsureMultispeqDevice).toHaveBeenCalledTimes(2);
  });
});
