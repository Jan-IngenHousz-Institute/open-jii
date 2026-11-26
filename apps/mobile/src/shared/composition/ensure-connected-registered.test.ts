import { ORPCError } from "@orpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Device } from "~/shared/types/device";

import type { DeviceIdentity } from "@repo/iot";

import {
  connectedRegistration,
  ensureConnectedRegistered,
  resetConnectedRegistrations,
} from "./ensure-connected-registered";

const mockEnsureConnectedDevice = vi.fn();

vi.mock("~/shared/api/client", () => ({
  getApiClient: () => ({ iot: { ensureConnectedDevice: mockEnsureConnectedDevice } }),
}));

let currentEnv = "dev";
vi.mock("~/shared/stores/environment-store", () => ({
  getEnvName: () => currentEnv,
}));

const ADDRESS = "98:D3:31:03:25:05";
const bluetooth: Device = { type: "bluetooth-classic", id: ADDRESS, name: "MultispeQ 02" };
const usb: Device = { type: "usb", id: "usb-1", name: "USB serial" };

function identity(overrides: Partial<DeviceIdentity> = {}): DeviceIdentity {
  return {
    family: "minipar",
    deviceId: "58:CF:79:12:34:56",
    name: "Greenhouse PAR 7",
    firmwareVersion: "1.07",
    raw: {},
    ...overrides,
  };
}

const multispeq = (overrides: Partial<DeviceIdentity> = {}) =>
  identity({
    family: "multispeq",
    deviceId: "31:03:25:05",
    name: "MultispeQ",
    firmwareVersion: "2.345",
    ...overrides,
  });

beforeEach(() => {
  currentEnv = "dev";
  resetConnectedRegistrations();
  mockEnsureConnectedDevice.mockReset();
  mockEnsureConnectedDevice.mockResolvedValue({ outcome: "created", device: null });
});

describe("connectedRegistration", () => {
  it.each(["ambit", "minipar", "co2dot"] as const)("keys a %s on its MAC", (family) => {
    expect(connectedRegistration(identity({ family }), usb)).toEqual({
      family,
      serialNumber: "58:CF:79:12:34:56",
      firmwareVersion: "1.07",
      name: "Greenhouse PAR 7",
    });
  });

  it("keys a MultispeQ over Bluetooth on its full address, with the bytes it reports", () => {
    expect(connectedRegistration(multispeq(), bluetooth)).toEqual({
      family: "multispeq",
      serialNumber: ADDRESS,
      reportedId: "31:03:25:05",
      firmwareVersion: "2.345",
    });
    expect(connectedRegistration(multispeq({ deviceId: "98:d3:31:03" }), bluetooth)).toMatchObject({
      serialNumber: ADDRESS,
      reportedId: "98:D3:31:03",
    });
  });

  it.each([
    ["a MultispeQ over USB", multispeq(), usb],
    [
      "a MultispeQ whose bytes do not fit its address",
      multispeq({ deviceId: "11:22:33:44" }),
      bluetooth,
    ],
    ["a MultispeQ that reports no bytes", multispeq({ deviceId: undefined }), bluetooth],
    [
      "the mock device",
      multispeq({ deviceId: "mock-1" }),
      { ...bluetooth, type: "mock-device" as const },
    ],
    ["firmware that reports no MAC", identity({ deviceId: undefined }), usb],
    ["a four-byte id on a MAC family", identity({ family: "ambit", deviceId: "03:25:05:25" }), usb],
    ["a generic device", identity({ family: "generic" }), usb],
  ])("registers nothing for %s", (_label, unit, device) => {
    expect(connectedRegistration(unit, device)).toBeNull();
  });

  it("leaves out placeholder names and firmware strings the registry cannot store", () => {
    const registration = connectedRegistration(
      identity({ name: "NoName", firmwareVersion: "v 2 beta!" }),
      usb,
    );
    expect(registration).not.toHaveProperty("name");
    expect(registration).not.toHaveProperty("firmwareVersion");
  });
});

describe("ensureConnectedRegistered", () => {
  it("sends the registration to the connected-device route", async () => {
    await ensureConnectedRegistered(identity({ family: "co2dot" }), usb);

    expect(mockEnsureConnectedDevice).toHaveBeenCalledWith({
      family: "co2dot",
      serialNumber: "58:CF:79:12:34:56",
      firmwareVersion: "1.07",
      name: "Greenhouse PAR 7",
    });
  });

  it("does not call the API for a unit it cannot key", async () => {
    await ensureConnectedRegistered(multispeq(), usb);

    expect(mockEnsureConnectedDevice).not.toHaveBeenCalled();
  });

  it("asks once per unit and environment while the app runs", async () => {
    await ensureConnectedRegistered(identity(), usb);
    await ensureConnectedRegistered(identity(), usb);
    currentEnv = "prod";
    await ensureConnectedRegistered(identity(), usb);

    expect(mockEnsureConnectedDevice).toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight call between concurrent connections", async () => {
    await Promise.all([
      ensureConnectedRegistered(identity(), usb),
      ensureConnectedRegistered(identity(), usb),
    ]);

    expect(mockEnsureConnectedDevice).toHaveBeenCalledTimes(1);
  });

  it("treats a refused identity as settled and does not ask again", async () => {
    mockEnsureConnectedDevice.mockRejectedValue(new ORPCError("CONFLICT", { status: 409 }));

    await ensureConnectedRegistered(identity(), usb);
    await ensureConnectedRegistered(identity(), usb);

    expect(mockEnsureConnectedDevice).toHaveBeenCalledTimes(1);
  });

  it("retries on the next connection after a transient failure, never throwing", async () => {
    mockEnsureConnectedDevice.mockRejectedValueOnce(new Error("offline"));

    await expect(ensureConnectedRegistered(identity(), usb)).resolves.toBeUndefined();
    await ensureConnectedRegistered(identity(), usb);

    expect(mockEnsureConnectedDevice).toHaveBeenCalledTimes(2);
  });
});
