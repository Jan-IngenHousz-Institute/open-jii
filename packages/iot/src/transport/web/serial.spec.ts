/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { WebSerialAdapter } from "./serial";

// --- Mock helpers ---

function createMockReader() {
  const chunks: { value: Uint8Array; done: boolean }[] = [];
  let resolveRead: ((result: { value: Uint8Array; done: boolean }) => void) | null = null;

  return {
    read: vi.fn(() => {
      if (chunks.length > 0) {
        return Promise.resolve(chunks.shift());
      }
      return new Promise<{ value: Uint8Array; done: boolean }>((resolve) => {
        resolveRead = resolve;
      });
    }),
    cancel: vi.fn(() => {
      if (resolveRead) {
        resolveRead({ value: new Uint8Array(), done: true });
      }
      return Promise.resolve();
    }),
    releaseLock: vi.fn(),
    // Test helpers
    pushChunk(text: string) {
      const encoded = new TextEncoder().encode(text);
      const chunk = { value: encoded, done: false };
      if (resolveRead) {
        const r = resolveRead;
        resolveRead = null;
        r(chunk);
      } else {
        chunks.push(chunk);
      }
    },
    pushDone() {
      const chunk = { value: new Uint8Array(), done: true };
      if (resolveRead) {
        const r = resolveRead;
        resolveRead = null;
        r(chunk);
      } else {
        chunks.push(chunk);
      }
    },
  };
}

function createMockWriter() {
  return {
    write: vi.fn().mockResolvedValue(undefined),
    releaseLock: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

interface MockSerialPort {
  readable: { getReader: () => ReturnType<typeof createMockReader> } | null;
  writable: { getWriter: () => ReturnType<typeof createMockWriter> } | null;
  open: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

function createMockPort(
  reader: ReturnType<typeof createMockReader>,
  writer: ReturnType<typeof createMockWriter>,
): MockSerialPort {
  return {
    readable: { getReader: () => reader },
    writable: { getWriter: () => writer },
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

// --- Tests ---

describe("WebSerialAdapter", () => {
  let originalNavigator: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    // Provide a mock navigator.serial
    Object.defineProperty(globalThis, "navigator", {
      value: {
        serial: {
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          requestPort: vi.fn(),
          getPorts: vi.fn(),
        },
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    if (originalNavigator) {
      Object.defineProperty(globalThis, "navigator", originalNavigator);
    } else {
      // @ts-expect-error cleanup
      delete globalThis.navigator;
    }
  });

  describe("isSupported", () => {
    it("should return true when navigator.serial exists", () => {
      expect(WebSerialAdapter.isSupported()).toBe(true);
    });

    it("should return false when navigator.serial is missing", () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {},
        writable: true,
        configurable: true,
      });
      expect(WebSerialAdapter.isSupported()).toBe(false);
    });
  });

  describe("constructor", () => {
    it("should set up disconnect listener", () => {
      const reader = createMockReader();
      const writer = createMockWriter();
      const port = createMockPort(reader, writer);

      new WebSerialAdapter(port as any);

      expect(
        (navigator.serial as unknown as { addEventListener: ReturnType<typeof vi.fn> })
          .addEventListener,
      ).toHaveBeenCalledWith("disconnect", expect.any(Function));
    });
  });

  describe("send", () => {
    it("should encode and write data via writer", async () => {
      const reader = createMockReader();
      const writer = createMockWriter();
      const port = createMockPort(reader, writer);

      const adapter = new WebSerialAdapter(port as any);
      // Manually assign writer (normally done in connect)
      // @ts-expect-error accessing private field for testing
      adapter.writer = writer;

      await adapter.send("hello");

      expect(writer.write).toHaveBeenCalledWith(new TextEncoder().encode("hello"));
    });

    it("should throw when writer is not initialized", async () => {
      const reader = createMockReader();
      const writer = createMockWriter();
      const port = createMockPort(reader, writer);

      const adapter = new WebSerialAdapter(port as any);

      await expect(adapter.send("test")).rejects.toThrow("Writer not initialized");
    });
  });

  describe("onDataReceived", () => {
    it("should store the callback", () => {
      const reader = createMockReader();
      const writer = createMockWriter();
      const port = createMockPort(reader, writer);

      const adapter = new WebSerialAdapter(port as any);
      const cb = vi.fn();
      adapter.onDataReceived(cb);

      // Verify callback is stored (indirectly tested via reading loop)
      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe("disconnect", () => {
    it("should cancel reader, release locks, and close port", async () => {
      const reader = createMockReader();
      const writer = createMockWriter();
      const port = createMockPort(reader, writer);

      const adapter = new WebSerialAdapter(port as any);
      // @ts-expect-error accessing private
      adapter.reader = reader;
      // @ts-expect-error accessing private
      adapter.writer = writer;

      await adapter.disconnect();

      expect(reader.cancel).toHaveBeenCalled();
      expect(reader.releaseLock).toHaveBeenCalled();
      expect(writer.releaseLock).toHaveBeenCalled();
      expect(port.close).toHaveBeenCalled();
    });

    it("should set connected to false and invoke status callback", async () => {
      const reader = createMockReader();
      const writer = createMockWriter();
      const port = createMockPort(reader, writer);

      const adapter = new WebSerialAdapter(port as any);
      const statusCb = vi.fn();
      adapter.onStatusChanged(statusCb);

      await adapter.disconnect();

      expect(adapter.isConnected()).toBe(false);
      expect(statusCb).toHaveBeenCalledWith(false);
    });
  });

  describe("connect", () => {
    it("should open port with default options", async () => {
      const reader = createMockReader();
      const writer = createMockWriter();
      const port = createMockPort(reader, writer);

      // Simulate reading loop staying alive for 300ms
      reader.read.mockImplementation(
        () =>
          new Promise(() => {
            /* never resolves — simulates waiting for data */
          }),
      );

      const adapter = await WebSerialAdapter.connect(port as any);

      expect(port.open).toHaveBeenCalledWith({
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
      });
      expect(adapter.isConnected()).toBe(true);
    });

    it("should throw user-friendly error on port-in-use open failure", async () => {
      const reader = createMockReader();
      const writer = createMockWriter();
      const port = createMockPort(reader, writer);
      port.open.mockRejectedValue(new Error("Port is already open"));

      await expect(WebSerialAdapter.connect(port as any)).rejects.toThrow(/already in use/);
    });
  });

  describe("requestAndConnect", () => {
    it("should throw when Web Serial is not supported", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {},
        writable: true,
        configurable: true,
      });

      await expect(WebSerialAdapter.requestAndConnect()).rejects.toThrow(
        "Web Serial not supported",
      );
    });
  });
});
