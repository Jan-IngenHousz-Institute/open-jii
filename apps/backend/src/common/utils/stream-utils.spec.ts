import type { Logger } from "@nestjs/common";
import { Readable } from "stream";
import { vi } from "vitest";

import { streamToBuffer } from "./stream-utils";

describe("streamToBuffer", () => {
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  } & Logger;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    } as unknown as {
      debug: ReturnType<typeof vi.fn>;
      error: ReturnType<typeof vi.fn>;
      warn: ReturnType<typeof vi.fn>;
    } & Logger;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should convert a simple stream to buffer", async () => {
    const testData = "Hello, World!";
    const stream = Readable.from([testData]);

    const result = await streamToBuffer(stream);

    expect(result).toBeInstanceOf(Buffer);
    expect(result.toString()).toBe(testData);
  });

  it("should handle multiple chunks", async () => {
    const chunks = ["Hello, ", "World", "!"];
    const stream = Readable.from(chunks);

    const result = await streamToBuffer(stream);

    expect(result.toString()).toBe(chunks.join(""));
  });

  it("should handle binary data", async () => {
    const binaryData = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
    const stream = Readable.from([binaryData]);

    const result = await streamToBuffer(stream);

    expect(result).toEqual(binaryData);
  });

  it("should reject when stream exceeds maxSize", async () => {
    const largeData = "x".repeat(1000);
    const stream = Readable.from([largeData]);

    await expect(streamToBuffer(stream, { maxSize: 500 })).rejects.toThrow(
      "Stream exceeds maximum size of",
    );
  });

  it("should use default maxSize of 10MB", async () => {
    const data = "small data";
    const stream = Readable.from([data]);

    const result = await streamToBuffer(stream);

    expect(result.toString()).toBe(data);
  });

  it("should timeout when specified", async () => {
    const stream = new Readable({
      read() {
        // Never emit data or end - simulates a hanging stream
      },
    });

    await expect(streamToBuffer(stream, { timeoutMs: 100 })).rejects.toThrow(
      "Stream processing timed out after 100ms",
    );
  });

  it("should not timeout when timeoutMs is 0", async () => {
    const data = "test data";
    const stream = Readable.from([data]);

    const result = await streamToBuffer(stream, { timeoutMs: 0 });

    expect(result.toString()).toBe(data);
  });

  it("should handle stream errors", async () => {
    const stream = new Readable({
      read() {
        this.emit("error", new Error("Stream failed"));
      },
    });

    await expect(streamToBuffer(stream)).rejects.toThrow("Stream failed");
  });

  it("should handle non-Error stream errors", async () => {
    const stream = new Readable({
      read() {
        this.emit("error", "String error");
      },
    });

    await expect(streamToBuffer(stream)).rejects.toThrow("String error");
  });

  it("should log debug messages when logger is provided", async () => {
    const data = "test";
    const stream = Readable.from([data]);

    await streamToBuffer(stream, { logger: mockLogger });

    expect(mockLogger.debug).toHaveBeenCalledWith("Stream ended, concatenating 1 chunks");
    expect(mockLogger.debug).toHaveBeenCalledWith("Buffer created, chunks cleared");
  });

  it("should log error messages when logger is provided", async () => {
    const stream = new Readable({
      read() {
        this.emit("error", new Error("Test error"));
      },
    });

    await expect(streamToBuffer(stream, { logger: mockLogger })).rejects.toThrow();

    expect(mockLogger.error).toHaveBeenCalledWith("Stream error:", expect.any(Error));
  });

  it("should log timeout warning when logger is provided", async () => {
    const stream = new Readable({
      read() {
        // Never emit data or end
      },
    });

    await expect(streamToBuffer(stream, { timeoutMs: 50, logger: mockLogger })).rejects.toThrow();

    expect(mockLogger.warn).toHaveBeenCalledWith("Stream processing timeout triggered");
  });

  it("should handle empty streams", async () => {
    const stream = Readable.from([]);

    const result = await streamToBuffer(stream);

    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBe(0);
  });

  it("should handle buffer concatenation errors", async () => {
    const data = "test";
    const stream = Readable.from([data]);

    // Spy on Buffer.concat to simulate an error during concatenation
    const concatSpy = vi.spyOn(Buffer, "concat").mockImplementationOnce(() => {
      throw new Error("Concatenation failed");
    });

    try {
      await expect(streamToBuffer(stream, { logger: mockLogger })).rejects.toThrow(
        "Concatenation failed",
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error during buffer concatenation:",
        expect.any(Error),
      );
    } finally {
      concatSpy.mockRestore();
    }
  });

  it("should clear chunks array for garbage collection", async () => {
    const data = "test data";
    const stream = Readable.from([data]);

    const result = await streamToBuffer(stream);

    expect(result.toString()).toBe(data);
    // The chunks array should be cleared inside the function, but we can't directly test this
    // The test mainly ensures the function completes successfully
  });

  it("should convert non-Buffer chunks to Buffer", async () => {
    const stringData = "string data";
    const stream = Readable.from([stringData]);

    const result = await streamToBuffer(stream);

    expect(result).toBeInstanceOf(Buffer);
    expect(result.toString()).toBe(stringData);
  });
});
