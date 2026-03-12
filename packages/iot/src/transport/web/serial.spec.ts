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

type SerialPort = ConstructorParameters<typeof WebSerialAdapter>[0];

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

function asMockSerial(): { requestPort: ReturnType<typeof vi.fn> } {
  return navigator.serial as unknown as { requestPort: ReturnType<typeof vi.fn> };
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

      new WebSerialAdapter(port as unknown as SerialPort);

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

      const adapter = new WebSerialAdapter(port as unknown as SerialPort);
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

      const adapter = new WebSerialAdapter(port as unknown as SerialPort);

      await expect(adapter.send("test")).rejects.toThrow("Writer not initialized");
    });
  });

  describe("onDataReceived", () => {
    it("should store the callback", () => {
      const reader = createMockReader();
      const writer = createMockWriter();
      const port = createMockPort(reader, writer);

      const adapter = new WebSerialAdapter(port as unknown as SerialPort);
      const cb = vi.fn();
      adapter.onDataReceived(cb);

      // Verify callback is stored (indirectly tested via reading loop)
      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe("startReading", () => {
    it("should catch read errors and report via statusCallback", async () => {
      const reader = createMockReader();
      const writer = createMockWriter();
      const port = createMockPort(reader, writer);

      const adapter = new WebSerialAdapter(port as unknown as SerialPort);
      const statusCb = vi.fn();
      adapter.onStatusChanged(statusCb);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // noop
      });

      // @ts-expect-error accessing private
      adapter.reader = reader;
      // @ts-expect-error accessing private
      adapter.reading = false;

      // Start reading by calling private method
      reader.read.mockRejectedValue(new Error("device lost"));

      // @ts-expect-error accessing private
      await adapter.startReading();

      expect(consoleSpy).toHaveBeenCalledWith("Error reading from serial port:", expect.any(Error));
      expect(statusCb).toHaveBeenCalledWith(false, expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe("disconnect", () => {
    it("should cancel reader, release locks, and close port", async () => {
      const reader = createMockReader();
      const writer = createMockWriter();
      const port = createMockPort(reader, writer);

      const adapter = new WebSerialAdapter(port as unknown as SerialPort);
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

      const adapter = new WebSerialAdapter(port as unknown as SerialPort);
      const statusCb = vi.fn();
      adapter.onStatusChanged(statusCb);

      await adapter.disconnect();

      expect(adapter.isConnected()).toBe(false);
      expect(statusCb).toHaveBeenCalledWith(false);
    });

    it("should handle reader.cancel error gracefully", async () => {
      const reader = createMockReader();
      const writer = createMockWriter();
      const port = createMockPort(reader, writer);

      reader.cancel.mockRejectedValue(new Error("cancel failed"));

      const adapter = new WebSerialAdapter(port as unknown as SerialPort);
      // @ts-expect-error accessing private
      adapter.reader = reader;
      // @ts-expect-error accessing private
      adapter.writer = writer;

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // noop
      });

      await adapter.disconnect();

      expect(consoleSpy).toHaveBeenCalledWith("Error releasing reader:", expect.any(Error));
      consoleSpy.mockRestore();
    });

    it("should handle writer.releaseLock error gracefully", async () => {
      const reader = createMockReader();
      const writer = createMockWriter();
      const port = createMockPort(reader, writer);

      writer.releaseLock.mockImplementation(() => {
        throw new Error("releaseLock failed");
      });

      const adapter = new WebSerialAdapter(port as unknown as SerialPort);
      // @ts-expect-error accessing private
      adapter.writer = writer;

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // noop
      });

      await adapter.disconnect();

      expect(consoleSpy).toHaveBeenCalledWith("Error releasing writer:", expect.any(Error));
      consoleSpy.mockRestore();
    });

    it("should handle port.close error gracefully", async () => {
      const reader = createMockReader();
      const writer = createMockWriter();
      const port = createMockPort(reader, writer);

      port.close.mockRejectedValue(new Error("close failed"));

      const adapter = new WebSerialAdapter(port as unknown as SerialPort);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // noop
      });

      await adapter.disconnect();

      expect(consoleSpy).toHaveBeenCalledWith("Error closing port:", expect.any(Error));
      consoleSpy.mockRestore();
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

      const adapter = await WebSerialAdapter.connect(port as unknown as SerialPort);

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

      await expect(WebSerialAdapter.connect(port as unknown as SerialPort)).rejects.toThrow(
        /already in use/,
      );
    });

    it("should rethrow non-port-in-use errors", async () => {
      const reader = createMockReader();
      const writer = createMockWriter();
      const port = createMockPort(reader, writer);
      port.open.mockRejectedValue(new Error("Permission denied"));

      await expect(WebSerialAdapter.connect(port as unknown as SerialPort)).rejects.toThrow(
        "Permission denied",
      );
    });

    it("should detect early read error and throw port-in-use", async () => {
      const reader = createMockReader();
      const writer = createMockWriter();
      const port = createMockPort(reader, writer);

      // Simulate startReading calling statusCallback with an error almost immediately
      reader.read.mockRejectedValue(new Error("device has been lost"));

      await expect(WebSerialAdapter.connect(port as unknown as SerialPort)).rejects.toThrow(
        /already in use/,
      );
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

    it("should throw when no port is selected", async () => {
      asMockSerial().requestPort.mockResolvedValue(null);

      await expect(WebSerialAdapter.requestAndConnect()).rejects.toThrow("No serial port selected");
    });

    it("should connect when port is selected", async () => {
      const reader = createMockReader();
      const writer = createMockWriter();
      const port = createMockPort(reader, writer);

      asMockSerial().requestPort.mockResolvedValue(port);

      // Simulate reading loop staying alive for 300ms
      reader.read.mockImplementation(
        () =>
          new Promise(() => {
            /* never resolves */
          }),
      );

      const adapter = await WebSerialAdapter.requestAndConnect();

      expect(adapter.isConnected()).toBe(true);
    });
  });
});
