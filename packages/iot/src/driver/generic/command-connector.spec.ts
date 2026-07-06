import { describe, it, expect, vi, beforeEach } from "vitest";

import { DEFAULT_MAX_BUFFER_SIZE } from "../driver-base";
import type { MockTransport } from "../testing/mock-transport";
import { createMockTransport } from "../testing/mock-transport";
import { GenericCommandConnector } from "./command-connector";

describe("GenericCommandConnector", () => {
  let connector: GenericCommandConnector;
  let transport: MockTransport;

  beforeEach(() => {
    connector = new GenericCommandConnector();
    transport = createMockTransport();
    connector.initialize(transport);
  });

  /** Make the next send() reply with `chunks`, delivered asynchronously. */
  function replyWith(...chunks: string[]) {
    vi.mocked(transport.send).mockImplementation(() => {
      setTimeout(() => {
        for (const chunk of chunks) transport.simulateData(chunk);
      }, 0);
      return Promise.resolve();
    });
  }

  it("exposes the generic family", () => {
    expect(connector.family).toBe("generic");
  });

  it.each([
    {
      name: "sends string commands verbatim with a newline",
      cmd: "RAW_CMD" as string | object,
      chunks: ["OK\n"],
      sent: "RAW_CMD\n",
      data: "OK" as unknown,
    },
    {
      name: "JSON-stringifies object commands",
      cmd: { command: "GO", speed: 3 },
      chunks: ["ack\n"],
      sent: '{"command":"GO","speed":3}\n',
      data: "ack",
    },
    {
      name: "assembles a reply from multiple chunks up to the newline",
      cmd: "cmd",
      chunks: ['{"a"', ":1}", "\n"],
      data: { a: 1 },
    },
    {
      name: "parses JSON reply lines into objects",
      cmd: "cmd",
      chunks: ['{"status":"done","v":2}\n'],
      data: { status: "done", v: 2 },
    },
    {
      name: "returns plain-text reply lines as strings, stripping a trailing CR",
      cmd: "cmd",
      chunks: ["hello world\r\n"],
      data: "hello world",
    },
  ])("$name", async ({ cmd, chunks, sent, data }) => {
    replyWith(...chunks);

    const result = await connector.execute(cmd);

    if (sent) expect(transport.send).toHaveBeenCalledWith(sent);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(data);
  });

  it("honours a custom line ending", async () => {
    const crlf = new GenericCommandConnector({ lineEnding: "\r\n" });
    crlf.initialize(transport);
    replyWith("pong\n");

    await crlf.execute("ping");

    expect(transport.send).toHaveBeenCalledWith("ping\r\n");
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

  it("cancel is a no-op when idle, identity is bare, execute before initialize throws", async () => {
    await connector.cancel();
    expect(transport.send).not.toHaveBeenCalled();
    await expect(connector.getDeviceIdentity()).resolves.toEqual({ family: "generic", raw: {} });
    const fresh = new GenericCommandConnector();
    await expect(fresh.execute("cmd")).rejects.toThrow(
      "Driver not initialized. Call initialize() first.",
    );
  });
});
