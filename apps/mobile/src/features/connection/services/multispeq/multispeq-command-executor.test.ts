import { describe, it, expect, vi } from "vitest";
import type { DeviceCommandProgress } from "~/features/connection/services/device-command-executor";
import type { SerialPortEvents } from "~/features/connection/services/device-connection-manager/android-serial-port-connection/serial-port-events";
import { Emitter } from "~/features/connection/utils/emitter";

import { MULTISPEQ_FRAMING } from "@repo/iot";

import { createMultispeqCommandExecutor } from "./multispeq-command-executor";
import { bluetoothClassicTransport } from "./transports/bluetooth-classic-transport";
import { serialPortTransport } from "./transports/serial-port-transport";

// The transport subscribes to the native disconnect event; capture the callback
// and the returned remove() so tests can drive an unexpected OS disconnect.
const btMock = vi.hoisted(() => ({
  disconnectCb: undefined as ((e: { device?: { address?: string } }) => void) | undefined,
  lastRemove: undefined as ReturnType<typeof vi.fn> | undefined,
}));
vi.mock("react-native-bluetooth-classic", () => ({
  default: {
    onDeviceDisconnected: vi.fn((cb: (e: { device?: { address?: string } }) => void) => {
      btMock.disconnectCb = cb;
      btMock.lastRemove = vi.fn();
      return { remove: btMock.lastRemove };
    }),
  },
}));

const CANCEL_FRAME = `-1+${MULTISPEQ_FRAMING.LINE_ENDING}`;

/** Generic mock ITransportAdapter with a hook to feed device data. */
function mockTransport() {
  let dataCb: ((data: string) => void) | undefined;
  return {
    isConnected: () => true,
    send: vi.fn().mockResolvedValue(undefined),
    onDataReceived: (cb: (data: string) => void) => {
      dataCb = cb;
    },
    onStatusChanged: vi.fn(),
    disconnect: vi.fn().mockResolvedValue(undefined),
    simulate: (data: string) => dataCb?.(data),
  };
}

const LONG_PROTOCOL = [
  {
    v_arrays: [],
    set_repeats: 1,
    _protocol_set_: [{ pulses: [100], pulse_distance: [1000], protocol_repeats: 1000 }],
  },
];

describe("createMultispeqCommandExecutor", () => {
  it("unwraps a successful CommandResult to raw data", async () => {
    const transport = mockTransport();
    transport.send.mockImplementation(() => {
      setTimeout(() => transport.simulate('{"value":42}ABCD1234\n'), 0);
      return Promise.resolve();
    });
    const executor = createMultispeqCommandExecutor(transport);

    await expect(executor.execute("cmd")).resolves.toEqual({ value: 42 });
  });

  it("returns plain-text replies verbatim", async () => {
    const transport = mockTransport();
    transport.send.mockImplementation(() => {
      setTimeout(() => transport.simulate("battery:85\n"), 0);
      return Promise.resolve();
    });
    const executor = createMultispeqCommandExecutor(transport);

    await expect(executor.execute("battery")).resolves.toBe("battery:85");
  });

  it("throws when the underlying command fails (timeout)", async () => {
    vi.useFakeTimers();
    try {
      const transport = mockTransport(); // never replies
      const executor = createMultispeqCommandExecutor(transport);

      const settled = executor.execute("cmd").catch((e: Error) => e);
      await vi.advanceTimersByTimeAsync(MULTISPEQ_FRAMING.DEFAULT_TIMEOUT + 1);

      const err = await settled;
      expect((err as Error).message).toBe("Command timeout");
    } finally {
      // Restore real timers even if the assertion throws, so a failure here
      // can't leave later tests running under fake timers.
      vi.useRealTimers();
    }
  });

  it("cancel() aborts the in-flight command, sends -1+, and rejects as cancelled", async () => {
    const transport = mockTransport(); // never replies on its own
    const executor = createMultispeqCommandExecutor(transport);

    const settled = executor.execute(LONG_PROTOCOL).catch((e: Error) => e);
    // Let the serialized command reach the driver and register its response
    // wait (a macrotask flush covers the executor's trace-handover hop plus the
    // queue + send microtasks) before we abort it.
    await new Promise((resolve) => setTimeout(resolve, 0));

    await executor.cancel();

    const err = await settled;
    expect((err as Error).message).toBe("Command cancelled");
    expect(transport.send).toHaveBeenCalledWith(CANCEL_FRAME);
  });

  it("streams command progress to onProgress subscribers", async () => {
    const transport = mockTransport();
    transport.send.mockImplementation(() => {
      // Reply arrives as two raw fragments; the driver frames on the newline.
      setTimeout(() => {
        transport.simulate('{"value":');
        transport.simulate("42}ABCD1234\n");
      }, 0);
      return Promise.resolve();
    });
    const executor = createMultispeqCommandExecutor(transport);

    const events: DeviceCommandProgress[] = [];
    const off = executor.onProgress((p) => events.push(p));

    await executor.execute("cmd");

    // "sent" fires first; a forced "receiving" reports the framed transfer.
    expect(events[0]?.phase).toBe("sent");
    const last = events.at(-1);
    expect(last?.phase).toBe("receiving");
    expect(last?.chunks).toBeGreaterThanOrEqual(1);
    expect(last?.bytes).toBeGreaterThan(0);
    expect(typeof last?.lastEventAt).toBe("number");

    // Unsubscribing stops further deliveries.
    off();
    const before = events.length;
    await executor.execute("cmd");
    expect(events.length).toBe(before);
  });

  it("keeps executing when a progress listener throws", async () => {
    const transport = mockTransport();
    transport.send.mockImplementation(() => {
      setTimeout(() => transport.simulate('{"ok":1}ABCD1234\n'), 0);
      return Promise.resolve();
    });
    const executor = createMultispeqCommandExecutor(transport);

    // A throwing listener must never break command execution.
    executor.onProgress(() => {
      throw new Error("bad listener");
    });

    await expect(executor.execute("cmd")).resolves.toEqual({ ok: 1 });
  });

  it("tears down the underlying driver on destroy()", async () => {
    const transport = mockTransport();
    const executor = createMultispeqCommandExecutor(transport);

    await executor.destroy();

    expect(transport.disconnect).toHaveBeenCalled();
  });

  it("cancels the in-flight command when the transport reports a disconnect", async () => {
    const transport = mockTransport();
    let statusCb: ((connected: boolean) => void) | undefined;
    transport.onStatusChanged.mockImplementation((cb: (connected: boolean) => void) => {
      statusCb = cb;
    });
    const executor = createMultispeqCommandExecutor(transport);

    const settled = executor.execute(LONG_PROTOCOL).catch((e: Error) => e);
    await new Promise((resolve) => setTimeout(resolve, 0));

    statusCb?.(false);

    const err = await settled;
    expect((err as Error).message).toBe("Command cancelled");
    expect(transport.send).toHaveBeenCalledWith(CANCEL_FRAME);
  });
});

describe("bluetoothClassicTransport", () => {
  /** Mock react-native-bluetooth-classic device that echoes a reply WITHOUT a trailing newline. */
  function mockBtDevice(reply: string) {
    let dataCb: ((event: { data: string }) => void) | undefined;
    return {
      address: "aa:bb:cc:dd:ee:ff",
      onDataReceived: (cb: (event: { data: string }) => void) => {
        dataCb = cb;
        return { remove: vi.fn() };
      },
      write: vi.fn().mockImplementation(() => {
        // The lib delivers complete messages with the "\n" delimiter stripped.
        setTimeout(() => dataCb?.({ data: reply }), 0);
        return Promise.resolve(true);
      }),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };
  }

  it("re-appends the newline so the driver frames a delimiter-stripped message", async () => {
    const device = mockBtDevice('{"ok":1}ABCD1234'); // no trailing "\n"
    const executor = createMultispeqCommandExecutor(
      bluetoothClassicTransport(
        device as unknown as Parameters<typeof bluetoothClassicTransport>[0],
      ),
    );

    await expect(executor.execute("cmd")).resolves.toEqual({ ok: 1 });
    expect(device.write).toHaveBeenCalledWith(`cmd${MULTISPEQ_FRAMING.LINE_ENDING}`);
  });

  /** Mock device with manual control over data events and the write result. */
  function controllableBtDevice(writeOk = true) {
    let dataCb: ((event: { data: unknown }) => void) | undefined;
    return {
      address: "aa:bb:cc:dd:ee:ff",
      onDataReceived: (cb: (event: { data: unknown }) => void) => {
        dataCb = cb;
        return { remove: vi.fn() };
      },
      write: vi.fn().mockResolvedValue(writeOk),
      disconnect: vi.fn().mockResolvedValue(undefined),
      emit: (data: unknown) => dataCb?.({ data }),
    };
  }

  function makeBtTransport(device: ReturnType<typeof controllableBtDevice>) {
    return bluetoothClassicTransport(
      device as unknown as Parameters<typeof bluetoothClassicTransport>[0],
    );
  }

  it("appends a newline only when the device message lacks one", () => {
    const device = controllableBtDevice();
    const transport = makeBtTransport(device);
    const received: string[] = [];
    transport.onDataReceived((d) => received.push(d));

    device.emit("already\n");
    device.emit("missing");

    expect(received).toEqual(["already\n", "missing\n"]);
  });

  it("ignores non-string device events", () => {
    const device = controllableBtDevice();
    const transport = makeBtTransport(device);
    const received: string[] = [];
    transport.onDataReceived((d) => received.push(d));

    device.emit(42);
    device.emit({ nested: true });

    expect(received).toEqual([]);
  });

  it("resolves send on a successful write and reports connected", async () => {
    const device = controllableBtDevice(true);
    const transport = makeBtTransport(device);

    expect(transport.isConnected()).toBe(true);
    transport.onStatusChanged(() => undefined);
    await expect(transport.send("cmd")).resolves.toBeUndefined();
    expect(device.write).toHaveBeenCalledWith("cmd");
  });

  it("throws when the device write reports failure", async () => {
    const device = controllableBtDevice(false);
    const transport = makeBtTransport(device);

    await expect(transport.send("cmd")).rejects.toThrow("Failed to write to device");
  });

  it("disconnects the underlying device", async () => {
    const device = controllableBtDevice();
    const transport = makeBtTransport(device);

    await transport.disconnect();

    expect(device.disconnect).toHaveBeenCalled();
  });

  it("on an unexpected OS disconnect: flips status, notifies, and removes both listeners", () => {
    const dataRemove = vi.fn();
    const device = {
      address: "aa:bb:cc:dd:ee:ff",
      onDataReceived: vi.fn(() => ({ remove: dataRemove })),
      write: vi.fn().mockResolvedValue(true),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };
    const transport = bluetoothClassicTransport(
      device as unknown as Parameters<typeof bluetoothClassicTransport>[0],
    );
    const onStatus = vi.fn();
    transport.onStatusChanged(onStatus);
    expect(transport.isConnected()).toBe(true);

    // An event for a different device is ignored.
    btMock.disconnectCb?.({ device: { address: "zz:zz" } });
    expect(transport.isConnected()).toBe(true);
    expect(onStatus).not.toHaveBeenCalled();

    // The matching device drops the connection and tears down both listeners.
    btMock.disconnectCb?.({ device: { address: "aa:bb:cc:dd:ee:ff" } });
    expect(transport.isConnected()).toBe(false);
    expect(onStatus).toHaveBeenCalledWith(false);
    expect(dataRemove).toHaveBeenCalled();
    expect(btMock.lastRemove).toHaveBeenCalled();
  });
});

describe("serialPortTransport", () => {
  it("bridges the serial emitter so the driver frames buffered chunks", async () => {
    const emitter = new Emitter<SerialPortEvents>();
    emitter.on("sendDataToDevice", () => {
      // Device replies in two raw chunks; the driver buffers until "\n".
      setTimeout(() => {
        void emitter.emit("dataReceivedFromDevice", '{"v":');
        void emitter.emit("dataReceivedFromDevice", "2}ABCD1234\n");
      }, 0);
    });

    const executor = createMultispeqCommandExecutor(serialPortTransport(emitter));

    await expect(executor.execute("cmd")).resolves.toEqual({ v: 2 });
  });

  it("forwards data, reports connected, and emits destroy on disconnect", async () => {
    const emitter = new Emitter<SerialPortEvents>();
    const sent: string[] = [];
    const destroyed = vi.fn();
    emitter.on("sendDataToDevice", (d) => {
      sent.push(d);
    });
    emitter.on("destroy", destroyed);

    const transport = serialPortTransport(emitter);

    expect(transport.isConnected()).toBe(true);
    transport.onStatusChanged(() => undefined);

    const received: string[] = [];
    transport.onDataReceived((d) => received.push(d));
    await emitter.emit("dataReceivedFromDevice", "chunk");
    expect(received).toEqual(["chunk"]);

    await transport.send("out");
    expect(sent).toEqual(["out"]);

    await transport.disconnect();
    expect(destroyed).toHaveBeenCalled();
  });

  it("treats a send failure (closed port) as a disconnect", async () => {
    const emitter = new Emitter<SerialPortEvents>();
    emitter.on("sendDataToDevice", () => {
      throw new Error("device not open");
    });
    const transport = serialPortTransport(emitter);
    const onStatus = vi.fn();
    transport.onStatusChanged(onStatus);

    await expect(transport.send("x")).rejects.toThrow("device not open");
    expect(onStatus).toHaveBeenCalledWith(false);
    expect(transport.isConnected()).toBe(false);
  });
});
