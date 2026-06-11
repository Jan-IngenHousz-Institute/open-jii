import type { BluetoothDevice } from "react-native-bluetooth-classic";
import { describe, expect, it } from "vitest";
import { Emitter } from "~/features/connection/utils/emitter";

import { bluetoothDeviceToMultispeqStream } from "./android-bluetooth-connection/bluetooth-device-to-multispeq-stream";
import type { SerialPortEvents } from "./android-serial-port-connection/serial-port-events";
import { serialPortToMultispeqStream } from "./android-serial-port-connection/serial-port-to-multispeq-stream";
import type { MultispeqStreamEvents } from "./multispeq-stream-events";

/**
 * Characterization of the two MultispeQ frame parsers as they behave TODAY.
 * The Bluetooth adapter strips the last 8 chars as checksum (assumes no
 * trailing newline); the serial adapter strips 9 (8-char checksum + "\n").
 * A future unification must keep every expectation below byte-identical.
 */

type Frame = MultispeqStreamEvents["receivedReplyFromDevice"];

const JSON_BODY = '{"device_name":"MultispeQ","sample":[1,2,3]}';
const CHECKSUM = "A1B2C3D4";

function createBluetoothHarness() {
  let onData: ((event: { data: unknown; eventType?: string }) => void) | undefined;
  const device = {
    onDataReceived(listener: (event: { data: unknown }) => void) {
      onData = listener;
      return { remove: () => undefined };
    },
    write: () => Promise.resolve(true),
    disconnect: () => Promise.resolve(true),
  } as unknown as BluetoothDevice;

  const stream = bluetoothDeviceToMultispeqStream(device);
  const frames: Frame[] = [];
  stream.on("receivedReplyFromDevice", (frame) => {
    frames.push(frame);
  });

  const receive = async (data: unknown) => {
    if (!onData) throw new Error("adapter never subscribed to onDataReceived");
    onData({ data, eventType: "READ" });
    await Promise.resolve(); // flush the fire-and-forget emit
  };

  return { frames, receive };
}

function createSerialHarness() {
  const port = new Emitter<SerialPortEvents>();
  const stream = serialPortToMultispeqStream(port);
  const frames: Frame[] = [];
  stream.on("receivedReplyFromDevice", (frame) => {
    frames.push(frame);
  });

  const receive = (chunk: string) => port.emit("dataReceivedFromDevice", chunk);

  return { frames, receive };
}

describe("bluetooth adapter: strips trailing 8 chars as checksum", () => {
  it("parses a JSON body followed by an 8-char checksum (no newline)", async () => {
    const bt = createBluetoothHarness();

    await bt.receive(JSON_BODY + CHECKSUM);

    expect(bt.frames).toEqual([
      { data: { device_name: "MultispeQ", sample: [1, 2, 3] }, checksum: CHECKSUM },
    ]);
  });

  it("a trailing newline shifts the 8-char window and degrades to the raw fallback", async () => {
    const bt = createBluetoothHarness();
    const raw = JSON_BODY + CHECKSUM + "\n";

    await bt.receive(raw);

    // slice(-8) eats "1B2C3D4\n", leaving body+"A" which fails JSON.parse.
    expect(bt.frames).toEqual([{ data: raw, checksum: "" }]);
  });

  it("a non-JSON body falls back to the FULL raw payload (checksum included) with checksum ''", async () => {
    const bt = createBluetoothHarness();
    const raw = "Warming up lamp..." + CHECKSUM;

    await bt.receive(raw);

    expect(bt.frames).toEqual([{ data: raw, checksum: "" }]);
  });

  it("a frame shorter than 8 chars is swallowed whole by the checksum window -> raw fallback", async () => {
    const bt = createBluetoothHarness();

    await bt.receive("abc");

    // slice(-8)="abc", slice(0,-8)="" -> JSON.parse("") throws.
    expect(bt.frames).toEqual([{ data: "abc", checksum: "" }]);
  });

  it("a 'null' body parses and emits null data despite the object|string frame type", async () => {
    const bt = createBluetoothHarness();

    await bt.receive("null" + CHECKSUM);

    expect(bt.frames).toEqual([{ data: null, checksum: CHECKSUM }]);
  });

  it("ignores non-string event data entirely (no frame emitted)", async () => {
    const bt = createBluetoothHarness();

    await bt.receive(42);
    await bt.receive(undefined);

    expect(bt.frames).toEqual([]);
  });
});

describe("serial adapter: strips trailing 9 chars (8 checksum + newline)", () => {
  it("parses a JSON body + checksum + newline", async () => {
    const serial = createSerialHarness();

    await serial.receive(JSON_BODY + CHECKSUM + "\n");

    expect(serial.frames).toEqual([
      { data: { device_name: "MultispeQ", sample: [1, 2, 3] }, checksum: CHECKSUM },
    ]);
  });

  it("buffers chunks until one ends with newline, then emits a single joined frame", async () => {
    const serial = createSerialHarness();

    await serial.receive('{"device_name":"Multi');
    await serial.receive('speQ","sample":[1,2,3]}');
    expect(serial.frames).toEqual([]); // no newline yet -> nothing emitted

    await serial.receive(CHECKSUM + "\n");

    expect(serial.frames).toEqual([
      { data: { device_name: "MultispeQ", sample: [1, 2, 3] }, checksum: CHECKSUM },
    ]);
  });

  it("a non-JSON body keeps the parsed checksum AND leaves the checksum chars inside data", async () => {
    const serial = createSerialHarness();

    await serial.receive("Warming up lamp..." + CHECKSUM + "\n");

    // Unlike bluetooth, checksum survives the fallback; only the newline is dropped.
    expect(serial.frames).toEqual([{ data: "Warming up lamp..." + CHECKSUM, checksum: CHECKSUM }]);
  });

  it("a degenerate short frame yields data === checksum", async () => {
    const serial = createSerialHarness();

    await serial.receive("ab\n");

    // slice(0,-9)="" fails parse; slice(-9,-1)="ab" doubles as data via slice(0,-1).
    expect(serial.frames).toEqual([{ data: "ab", checksum: "ab" }]);
  });
});

describe("cross-adapter parity (gate for unification)", () => {
  it("canonical JSON frame yields IDENTICAL frames via both transports", async () => {
    const bt = createBluetoothHarness();
    const serial = createSerialHarness();

    // Today each transport delivers its own framing: BT without, serial with newline.
    await bt.receive(JSON_BODY + CHECKSUM);
    await serial.receive(JSON_BODY + CHECKSUM + "\n");

    expect(bt.frames).toHaveLength(1);
    expect(bt.frames).toEqual(serial.frames);
  });

  it("the SAME newline-terminated raw string diverges: BT falls back raw, serial parses", async () => {
    const bt = createBluetoothHarness();
    const serial = createSerialHarness();
    const raw = JSON_BODY + CHECKSUM + "\n";

    await bt.receive(raw);
    await serial.receive(raw);

    expect(bt.frames).toEqual([{ data: raw, checksum: "" }]);
    expect(serial.frames).toEqual([
      { data: { device_name: "MultispeQ", sample: [1, 2, 3] }, checksum: CHECKSUM },
    ]);
  });

  it("non-JSON fallback diverges only in checksum: same data string, '' vs parsed checksum", async () => {
    const bt = createBluetoothHarness();
    const serial = createSerialHarness();
    const body = "Warming up lamp..." + CHECKSUM;

    await bt.receive(body);
    await serial.receive(body + "\n");

    expect(bt.frames).toEqual([{ data: body, checksum: "" }]);
    expect(serial.frames).toEqual([{ data: body, checksum: CHECKSUM }]);
    expect(bt.frames[0].data).toEqual(serial.frames[0].data);
  });
});
