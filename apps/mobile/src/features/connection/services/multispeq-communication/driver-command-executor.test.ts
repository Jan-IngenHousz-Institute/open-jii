import { describe, it, expect, vi } from "vitest";
import { Emitter } from "~/features/connection/utils/emitter";

import { MULTISPEQ_FRAMING } from "@repo/iot";

import type { SerialPortEvents } from "./android-serial-port-connection/serial-port-events";
import { createDriverCommandExecutor } from "./driver-command-executor";
import { bluetoothClassicTransport } from "./transports/bluetooth-classic-transport";
import { serialPortTransport } from "./transports/serial-port-transport";

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

describe("createDriverCommandExecutor", () => {
  it("unwraps a successful CommandResult to raw data", async () => {
    const transport = mockTransport();
    transport.send.mockImplementation(() => {
      setTimeout(() => transport.simulate('{"value":42}ABCD1234\n'), 0);
      return Promise.resolve();
    });
    const executor = createDriverCommandExecutor(transport);

    await expect(executor.execute("cmd")).resolves.toEqual({ value: 42 });
  });

  it("returns plain-text replies verbatim", async () => {
    const transport = mockTransport();
    transport.send.mockImplementation(() => {
      setTimeout(() => transport.simulate("battery:85\n"), 0);
      return Promise.resolve();
    });
    const executor = createDriverCommandExecutor(transport);

    await expect(executor.execute("battery")).resolves.toBe("battery:85");
  });

  it("throws when the underlying command fails (timeout)", async () => {
    vi.useFakeTimers();
    const transport = mockTransport(); // never replies
    const executor = createDriverCommandExecutor(transport);

    const settled = executor.execute("cmd").catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(MULTISPEQ_FRAMING.DEFAULT_TIMEOUT + 1);

    const err = await settled;
    expect((err as Error).message).toBe("Command timeout");
    vi.useRealTimers();
  });

  it("cancel() aborts the in-flight command, sends -1+, and rejects as cancelled", async () => {
    const transport = mockTransport(); // never replies on its own
    const executor = createDriverCommandExecutor(transport);

    const settled = executor.execute(LONG_PROTOCOL).catch((e: Error) => e);
    // Let the queued command register its response wait.
    await Promise.resolve();
    await Promise.resolve();

    await executor.cancel();

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
      onDataReceived: (cb: (event: { data: string }) => void) => {
        dataCb = cb;
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
    const executor = createDriverCommandExecutor(
      bluetoothClassicTransport(
        device as unknown as Parameters<typeof bluetoothClassicTransport>[0],
      ),
    );

    await expect(executor.execute("cmd")).resolves.toEqual({ ok: 1 });
    expect(device.write).toHaveBeenCalledWith(`cmd${MULTISPEQ_FRAMING.LINE_ENDING}`);
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

    const executor = createDriverCommandExecutor(serialPortTransport(emitter));

    await expect(executor.execute("cmd")).resolves.toEqual({ v: 2 });
  });
});
