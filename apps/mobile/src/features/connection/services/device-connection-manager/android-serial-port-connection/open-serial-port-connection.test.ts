/**
 * The fake native module mirrors UsbSerialportForAndroidModule: ports keyed by
 * deviceId, open() resolving early for an open id, and close(deviceId) closing
 * whichever port currently holds that id.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useScannerCommandExecutorStore } from "~/features/connection/stores/use-scanner-command-executor-store";
import type { Device } from "~/shared/types/device";

import { connectToDevice } from "../device-connection";
import { closeAllSerialPorts } from "../serial-port-connection";
import { openSerialPortConnection } from "./open-serial-port-connection";

const native = vi.hoisted(() => {
  interface RxEvent {
    deviceId: number;
    data: string;
  }
  const listeners = new Set<(e: RxEvent) => void>();
  const ports = new Map<number, { lineBuffer: string }>();
  const calls = { open: 0, portsCreated: 0, closes: 0 };

  const toText = (hex: string) =>
    hex.replace(/../g, (byte) => String.fromCharCode(parseInt(byte, 16)));
  const toHex = (text: string) =>
    Array.from(text, (c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();

  // miniPAR fw 1.05 LINE mode: '\r' dropped, reply then Serial.println().
  const replyTo = (line: string) => {
    if (line === "hello") return "MiniPAR,1.1,1.05\r\n";
    if (line === "get_name") return "NoName\r\n";
    return "error:unknown_command\r\n";
  };
  const deviceReceive = (deviceId: number, text: string) => {
    const port = ports.get(deviceId);
    if (!port) return;
    port.lineBuffer += text.replace(/\r/g, "");
    let newline = port.lineBuffer.indexOf("\n");
    while (newline >= 0) {
      const line = port.lineBuffer.slice(0, newline).trim();
      port.lineBuffer = port.lineBuffer.slice(newline + 1);
      const reply = replyTo(line);
      setTimeout(() => {
        if (!ports.has(deviceId)) return;
        for (const listener of Array.from(listeners)) listener({ deviceId, data: toHex(reply) });
      }, 1);
      newline = port.lineBuffer.indexOf("\n");
    }
  };

  class UsbSerial {
    private subs: ((e: RxEvent) => void)[] = [];
    constructor(readonly deviceId: number) {}
    onReceived(listener: (e: RxEvent) => void) {
      const proxy = (e: RxEvent) => {
        if (e.deviceId !== this.deviceId || !e.data) return;
        listener(e);
      };
      listeners.add(proxy);
      this.subs.push(proxy);
      return { remove: () => listeners.delete(proxy) };
    }
    send(hex: string) {
      if (!ports.has(this.deviceId)) return Promise.reject(new Error("device not open"));
      deviceReceive(this.deviceId, toText(hex));
      return Promise.resolve(null);
    }
    close() {
      for (const sub of this.subs) listeners.delete(sub);
      if (!ports.has(this.deviceId)) {
        return Promise.reject(new Error("serial port not open or closed"));
      }
      calls.closes += 1;
      ports.delete(this.deviceId);
      return Promise.resolve(null);
    }
  }

  const UsbSerialManager = {
    list: () => Promise.resolve([{ deviceId: 2002, vendorId: 0x303a, productId: 0x1001 }]),
    hasPermission: () => Promise.resolve(true),
    tryRequestPermission: () => Promise.resolve(true),
    open: (id: number) => {
      calls.open += 1;
      if (!ports.has(id)) {
        ports.set(id, { lineBuffer: "" });
        calls.portsCreated += 1;
      }
      return Promise.resolve(new UsbSerial(id));
    },
  };

  return { UsbSerialManager, calls, ports };
});

vi.mock("react-native-usb-serialport-for-android", () => ({
  UsbSerialManager: native.UsbSerialManager,
  Parity: { None: 0 },
}));
vi.mock("react-native-bluetooth-classic", () => ({ default: {} }));

describe("openSerialPortConnection", () => {
  beforeEach(() => {
    native.ports.clear();
    Object.assign(native.calls, { open: 0, portsCreated: 0, closes: 0 });
  });

  it("closes the native port once per handle, even when the handle is destroyed twice", async () => {
    const old = await openSerialPortConnection(2002);
    await old.emit("destroy");
    const fresh = await openSerialPortConnection(2002);

    // The registry and the old executor's transport both destroy the old handle.
    await old.emit("destroy");

    expect(native.calls.closes).toBe(1);
    expect(native.ports.has(2002)).toBe(true);
    await fresh.emit("destroy");
  });
});

// Everything below the native boundary is real here: the serial registry, the
// permission gate, the serial transport, IdentifiedCommandExecutor with the
// @repo/iot identification, and the executor store.
const device: Device = { id: "2002", type: "usb", name: "303a:1001 #2002" };
const store = useScannerCommandExecutorStore;

async function connect() {
  await connectToDevice(device);
  await store.getState().addDevice(device);
  await vi.waitFor(() => expect(store.getState().executors.get("2002")?.identity).toBeDefined());
}

describe("reconnecting a USB device", () => {
  beforeEach(async () => {
    await store.getState().destroy();
    await closeAllSerialPorts();
    native.ports.clear();
    Object.assign(native.calls, { open: 0, portsCreated: 0, closes: 0 });
  });

  it("keeps the new port open when the replaced executor is destroyed", async () => {
    await connect();

    // Reconnect while the first executor is still registered (auto-reconnect,
    // or a reconnect after a device reset).
    await connect();

    expect(native.calls.portsCreated).toBe(2);
    // The registry closes the old handle once; the old executor's own
    // teardown must not close the port that replaced it.
    expect(native.calls.closes).toBe(1);
    expect(native.ports.has(2002)).toBe(true);
    await expect(store.getState().executeCommandOn("2002", "hello")).resolves.toBe(
      "MiniPAR,1.1,1.05",
    );
  });
});
