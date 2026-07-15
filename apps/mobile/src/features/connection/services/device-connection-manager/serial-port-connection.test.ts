import { beforeEach, describe, expect, it, vi } from "vitest";
import { Emitter } from "~/features/connection/utils/emitter";
import type { Device } from "~/shared/types/device";

import {
  closeAllSerialPorts,
  closeSerialPort,
  getConnectedSerialPortDevices,
  getSerialPortConnection,
  openSerialPort,
  pruneSerialPorts,
} from "./serial-port-connection";

const openSerialPortConnection = vi.fn();
vi.mock(
  "~/features/connection/services/multispeq-communication/android-serial-port-connection/open-serial-port-connection",
  () => ({
    openSerialPortConnection: (deviceId: number) => openSerialPortConnection(deviceId),
  }),
);

const usbDevice = (id: string): Device => ({ id, type: "usb", name: `MultispeQ #${id}` });

function makeConnection() {
  const emitter = new Emitter<{ destroy: void }>();
  const destroyed = vi.fn();
  emitter.on("destroy", destroyed);
  return { emitter, destroyed };
}

describe("serial port registry", () => {
  beforeEach(async () => {
    openSerialPortConnection.mockReset();
    // Module state persists across tests; drain the registry.
    openSerialPortConnection.mockResolvedValue(makeConnection().emitter);
    await closeAllSerialPorts();
  });

  it("opens one connection per device and lists them in connect order", async () => {
    const a = makeConnection();
    const b = makeConnection();
    openSerialPortConnection.mockResolvedValueOnce(a.emitter).mockResolvedValueOnce(b.emitter);

    await openSerialPort(usbDevice("11"));
    await openSerialPort(usbDevice("22"));

    expect(openSerialPortConnection).toHaveBeenCalledWith(11);
    expect(openSerialPortConnection).toHaveBeenCalledWith(22);
    expect(getConnectedSerialPortDevices().map((d) => d.id)).toEqual(["11", "22"]);
    expect(getSerialPortConnection("11")).toBe(a.emitter);
    expect(getSerialPortConnection("22")).toBe(b.emitter);
  });

  it("tears down the previous connection before reopening the same device (replug)", async () => {
    const stale = makeConnection();
    const fresh = makeConnection();
    openSerialPortConnection
      .mockResolvedValueOnce(stale.emitter)
      .mockResolvedValueOnce(fresh.emitter);

    await openSerialPort(usbDevice("11")); // open #1 (the leaked/stale one on replug)
    await openSerialPort(usbDevice("11")); // reconnect

    expect(stale.destroyed).toHaveBeenCalledTimes(1);
    expect(getConnectedSerialPortDevices()).toHaveLength(1);
    expect(getSerialPortConnection("11")).toBe(fresh.emitter);
  });

  it("closeSerialPort destroys only that device's connection", async () => {
    const a = makeConnection();
    const b = makeConnection();
    openSerialPortConnection.mockResolvedValueOnce(a.emitter).mockResolvedValueOnce(b.emitter);
    await openSerialPort(usbDevice("11"));
    await openSerialPort(usbDevice("22"));

    await closeSerialPort("11");

    expect(a.destroyed).toHaveBeenCalledTimes(1);
    expect(b.destroyed).not.toHaveBeenCalled();
    expect(getConnectedSerialPortDevices().map((d) => d.id)).toEqual(["22"]);
    expect(getSerialPortConnection("11")).toBeUndefined();
  });

  it("pruneSerialPorts closes entries missing from the USB bus and returns their ids", async () => {
    const a = makeConnection();
    const b = makeConnection();
    openSerialPortConnection.mockResolvedValueOnce(a.emitter).mockResolvedValueOnce(b.emitter);
    await openSerialPort(usbDevice("11"));
    await openSerialPort(usbDevice("22"));

    const removed = pruneSerialPorts(new Set(["22"]));

    expect(removed).toEqual(["11"]);
    expect(a.destroyed).toHaveBeenCalledTimes(1);
    expect(getConnectedSerialPortDevices().map((d) => d.id)).toEqual(["22"]);
  });

  it("keeps every entry when all devices are still on the bus", async () => {
    const a = makeConnection();
    openSerialPortConnection.mockResolvedValueOnce(a.emitter);
    await openSerialPort(usbDevice("11"));

    const removed = pruneSerialPorts(new Set(["11"]));

    expect(removed).toEqual([]);
    expect(a.destroyed).not.toHaveBeenCalled();
    expect(getConnectedSerialPortDevices().map((d) => d.id)).toEqual(["11"]);
  });

  it("swallows destroy failures while closing (already-dead port)", async () => {
    const emitter = new Emitter<{ destroy: void }>();
    emitter.on("destroy", () => {
      throw new Error("port already closed");
    });
    openSerialPortConnection.mockResolvedValueOnce(emitter);
    await openSerialPort(usbDevice("11"));

    await expect(closeSerialPort("11")).resolves.toBeUndefined();
    expect(getConnectedSerialPortDevices()).toEqual([]);
  });

  it("closeAllSerialPorts empties the registry", async () => {
    const a = makeConnection();
    const b = makeConnection();
    openSerialPortConnection.mockResolvedValueOnce(a.emitter).mockResolvedValueOnce(b.emitter);
    await openSerialPort(usbDevice("11"));
    await openSerialPort(usbDevice("22"));

    await closeAllSerialPorts();

    expect(a.destroyed).toHaveBeenCalledTimes(1);
    expect(b.destroyed).toHaveBeenCalledTimes(1);
    expect(getConnectedSerialPortDevices()).toEqual([]);
  });
});
