import type { BluetoothDevice } from "react-native-bluetooth-classic";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { probeIsMultispeq } from "./probe-is-multispeq";

type DataListener = (event: { data: unknown }) => void;

interface FakeDeviceOptions {
  startsConnected?: boolean;
  isConnectedThrows?: boolean;
  connectThrows?: boolean;
  writeReturns?: boolean;
  writeThrows?: boolean;
}

function createFakeDevice(options: FakeDeviceOptions = {}) {
  const {
    startsConnected = false,
    isConnectedThrows = false,
    connectThrows = false,
    writeReturns = true,
    writeThrows = false,
  } = options;

  let connected = startsConnected;
  const listeners = new Set<DataListener>();

  const connect = vi.fn(() => {
    if (connectThrows) return Promise.reject(new Error("connect failed"));
    connected = true;
    return Promise.resolve();
  });
  const disconnect = vi.fn(() => {
    connected = false;
    return Promise.resolve(true);
  });
  const isConnected = vi.fn(() => {
    if (isConnectedThrows) return Promise.reject(new Error("isConnected failed"));
    return Promise.resolve(connected);
  });
  const write = vi.fn(() => {
    if (writeThrows) return Promise.reject(new Error("write failed"));
    return Promise.resolve(writeReturns);
  });
  const onDataReceived = vi.fn((listener: DataListener) => {
    listeners.add(listener);
    return { remove: () => listeners.delete(listener) };
  });

  const emitData = (data: unknown) => {
    for (const listener of listeners) listener({ data });
  };

  const device = {
    connect,
    disconnect,
    isConnected,
    write,
    onDataReceived,
  } as unknown as BluetoothDevice;

  return {
    device,
    spies: { connect, disconnect, isConnected, write, onDataReceived },
    emitData,
    get listenerCount() {
      return listeners.size;
    },
  };
}

describe("probeIsMultispeq", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true when the device replies with a JSON-shaped payload within the timeout", async () => {
    const fake = createFakeDevice();
    const promise = probeIsMultispeq(fake.device);

    // Drain the microtask queue so the probe registers its data listener and
    // calls write() before we emit the reply.
    await vi.advanceTimersByTimeAsync(0);
    fake.emitData('{"firmware_version":"2.0"}' + "12345678");

    await expect(promise).resolves.toBe(true);
    expect(fake.spies.connect).toHaveBeenCalledOnce();
    expect(fake.spies.write).toHaveBeenCalledWith("hello\r\n");
  });

  it("returns false when the reply isn't parseable JSON (with the 8-char checksum stripped)", async () => {
    const fake = createFakeDevice();
    const promise = probeIsMultispeq(fake.device);

    await vi.advanceTimersByTimeAsync(0);
    fake.emitData("not-json-at-all" + "checksum");

    await expect(promise).resolves.toBe(false);
  });

  it("returns false when no reply arrives within the 3s timeout", async () => {
    const fake = createFakeDevice();
    const promise = probeIsMultispeq(fake.device);

    await vi.advanceTimersByTimeAsync(3000);

    await expect(promise).resolves.toBe(false);
    expect(fake.listenerCount).toBe(0);
  });

  it("returns false and skips disconnect when connect() rejects", async () => {
    const fake = createFakeDevice({ connectThrows: true });

    await expect(probeIsMultispeq(fake.device)).resolves.toBe(false);
    expect(fake.spies.connect).toHaveBeenCalledOnce();
    expect(fake.spies.disconnect).not.toHaveBeenCalled();
  });

  it("does not disconnect a device that was already connected before the probe", async () => {
    const fake = createFakeDevice({ startsConnected: true });
    const promise = probeIsMultispeq(fake.device);

    await vi.advanceTimersByTimeAsync(0);
    fake.emitData('{"ok":true}' + "12345678");

    await expect(promise).resolves.toBe(true);
    expect(fake.spies.connect).not.toHaveBeenCalled();
    expect(fake.spies.disconnect).not.toHaveBeenCalled();
  });

  it("disconnects after probing if the probe opened the connection itself", async () => {
    const fake = createFakeDevice();
    const promise = probeIsMultispeq(fake.device);

    await vi.advanceTimersByTimeAsync(0);
    fake.emitData('{"ok":true}' + "12345678");
    await promise;

    expect(fake.spies.disconnect).toHaveBeenCalledOnce();
  });

  it("returns false when write() resolves with falsy (write rejected by the SPP socket)", async () => {
    const fake = createFakeDevice({ writeReturns: false });
    const promise = probeIsMultispeq(fake.device);

    await vi.advanceTimersByTimeAsync(0);

    await expect(promise).resolves.toBe(false);
    expect(fake.listenerCount).toBe(0);
  });

  it("returns false when write() throws", async () => {
    const fake = createFakeDevice({ writeThrows: true });
    const promise = probeIsMultispeq(fake.device);

    await vi.advanceTimersByTimeAsync(0);

    await expect(promise).resolves.toBe(false);
  });

  it("ignores non-string data events and waits for the next reply", async () => {
    const fake = createFakeDevice();
    const promise = probeIsMultispeq(fake.device);

    await vi.advanceTimersByTimeAsync(0);
    fake.emitData(Buffer.from([0x01, 0x02]));
    fake.emitData('{"ok":true}' + "12345678");

    await expect(promise).resolves.toBe(true);
  });

  it("treats isConnected() throwing as not-connected and proceeds with connect()", async () => {
    const fake = createFakeDevice({ isConnectedThrows: true });
    const promise = probeIsMultispeq(fake.device);

    await vi.advanceTimersByTimeAsync(0);
    fake.emitData('{"ok":true}' + "12345678");

    await expect(promise).resolves.toBe(true);
    expect(fake.spies.connect).toHaveBeenCalledOnce();
    expect(fake.spies.disconnect).toHaveBeenCalledOnce();
  });
});
