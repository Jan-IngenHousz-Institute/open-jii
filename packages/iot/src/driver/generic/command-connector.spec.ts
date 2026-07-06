import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ITransportAdapter } from "../../transport/interface";
import { DEFAULT_MAX_BUFFER_SIZE } from "../driver-base";
import { GenericCommandConnector } from "./command-connector";

function createMockTransport(): ITransportAdapter & {
  simulateData: (data: string) => void;
} {
  let dataCallback: ((data: string) => void) | undefined;

  return {
    isConnected: vi.fn().mockReturnValue(true),
    send: vi.fn().mockResolvedValue(undefined),
    onDataReceived: vi.fn((cb: (data: string) => void) => {
      dataCallback = cb;
    }),
    onStatusChanged: vi.fn(),
    disconnect: vi.fn().mockResolvedValue(undefined),
    simulateData(data: string) {
      dataCallback?.(data);
    },
  };
}

describe("GenericCommandConnector", () => {
  let connector: GenericCommandConnector;
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(() => {
    connector = new GenericCommandConnector();
    transport = createMockTransport();
    connector.initialize(transport);
  });

  it("exposes the generic family", () => {
    expect(connector.family).toBe("generic");
  });

  it("sends string commands verbatim with a newline", async () => {
    vi.mocked(transport.send).mockImplementation(() => {
      setTimeout(() => transport.simulateData("OK\n"), 0);
      return Promise.resolve();
    });

    const result = await connector.execute("RAW_CMD");

    expect(transport.send).toHaveBeenCalledWith("RAW_CMD\n");
    expect(result.success).toBe(true);
    expect(result.data).toBe("OK");
  });

  it("JSON-stringifies object commands", async () => {
    vi.mocked(transport.send).mockImplementation(() => {
      setTimeout(() => transport.simulateData("ack\n"), 0);
      return Promise.resolve();
    });

    await connector.execute({ command: "GO", speed: 3 });

    expect(transport.send).toHaveBeenCalledWith('{"command":"GO","speed":3}\n');
  });

  it("honours a custom line ending", async () => {
    const crlf = new GenericCommandConnector({ lineEnding: "\r\n" });
    crlf.initialize(transport);
    vi.mocked(transport.send).mockImplementation(() => {
      setTimeout(() => transport.simulateData("pong\n"), 0);
      return Promise.resolve();
    });

    await crlf.execute("ping");

    expect(transport.send).toHaveBeenCalledWith("ping\r\n");
  });

  it("assembles a reply from multiple chunks up to the newline", async () => {
    vi.mocked(transport.send).mockImplementation(() => {
      setTimeout(() => {
        transport.simulateData('{"a"');
        transport.simulateData(":1}");
        transport.simulateData("\n");
      }, 0);
      return Promise.resolve();
    });

    const result = await connector.execute("cmd");

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ a: 1 });
  });

  it("parses JSON reply lines into objects", async () => {
    vi.mocked(transport.send).mockImplementation(() => {
      setTimeout(() => transport.simulateData('{"status":"done","v":2}\n'), 0);
      return Promise.resolve();
    });

    const result = await connector.execute("cmd");

    expect(result.data).toEqual({ status: "done", v: 2 });
  });

  it("returns plain-text reply lines as strings, stripping a trailing CR", async () => {
    vi.mocked(transport.send).mockImplementation(() => {
      setTimeout(() => transport.simulateData("hello world\r\n"), 0);
      return Promise.resolve();
    });

    const result = await connector.execute("cmd");

    expect(result.data).toBe("hello world");
  });

  it("fails with Command timeout when the device stays silent", async () => {
    vi.useFakeTimers();
    try {
      const quick = new GenericCommandConnector({ timeoutMs: 500 });
      quick.initialize(transport);

      const resultPromise = quick.execute("cmd");
      await vi.advanceTimersByTimeAsync(501);

      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("Command timeout");
    } finally {
      vi.useRealTimers();
    }
  });

  it("discards the buffer and emits bufferOverflow when it grows past the limit", () => {
    const listener = vi.fn();
    connector.on("bufferOverflow", listener);

    transport.simulateData("x".repeat(DEFAULT_MAX_BUFFER_SIZE + 1));

    expect(listener).toHaveBeenCalledWith({ discardedBytes: DEFAULT_MAX_BUFFER_SIZE + 1 });

    // The connector still works after the discard
    transport.simulateData("late\n");
  });

  it("cancels an in-flight command locally without sending a device abort", async () => {
    const resultPromise = connector.execute("cmd");
    await Promise.resolve();
    await Promise.resolve();

    await connector.cancel();

    const result = await resultPromise;
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe("Command cancelled");
    // Only the command itself went out; sendCancelToDevice stays a no-op.
    expect(transport.send).toHaveBeenCalledTimes(1);
    expect(transport.send).toHaveBeenCalledWith("cmd\n");
  });

  it("is a no-op to cancel when idle", async () => {
    await connector.cancel();
    expect(transport.send).not.toHaveBeenCalled();
  });

  it("reports a bare generic identity", async () => {
    await expect(connector.getDeviceIdentity()).resolves.toEqual({
      family: "generic",
      raw: {},
    });
  });

  it("throws when executing before initialize", async () => {
    const fresh = new GenericCommandConnector();
    await expect(fresh.execute("cmd")).rejects.toThrow(
      "Driver not initialized. Call initialize() first.",
    );
  });
});
