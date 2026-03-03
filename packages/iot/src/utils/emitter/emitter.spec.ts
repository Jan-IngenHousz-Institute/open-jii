import { describe, it, expect, vi } from "vitest";

import { Emitter } from "./emitter";

interface TestEvents extends Record<string, unknown> {
  message: string;
  data: { value: number };
  empty: void;
}

describe("Emitter", () => {
  it("should call listeners when event is emitted", async () => {
    const emitter = new Emitter<TestEvents>();
    const listener = vi.fn();

    emitter.on("message", listener);
    await emitter.emit("message", "hello");

    expect(listener).toHaveBeenCalledWith("hello");
  });

  it("should support multiple listeners for same event", async () => {
    const emitter = new Emitter<TestEvents>();
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    emitter.on("message", listener1);
    emitter.on("message", listener2);
    await emitter.emit("message", "hello");

    expect(listener1).toHaveBeenCalledWith("hello");
    expect(listener2).toHaveBeenCalledWith("hello");
  });

  it("should not call listeners for other events", async () => {
    const emitter = new Emitter<TestEvents>();
    const listener = vi.fn();

    emitter.on("message", listener);
    await emitter.emit("data", { value: 42 });

    expect(listener).not.toHaveBeenCalled();
  });

  it("should remove a specific listener with off()", async () => {
    const emitter = new Emitter<TestEvents>();
    const listener = vi.fn();

    emitter.on("message", listener);
    emitter.off("message", listener);
    await emitter.emit("message", "hello");

    expect(listener).not.toHaveBeenCalled();
  });

  it("should only remove the specified listener", async () => {
    const emitter = new Emitter<TestEvents>();
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    emitter.on("message", listener1);
    emitter.on("message", listener2);
    emitter.off("message", listener1);
    await emitter.emit("message", "hello");

    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).toHaveBeenCalledWith("hello");
  });

  it("should remove all listeners with removeAllListeners()", async () => {
    const emitter = new Emitter<TestEvents>();
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    emitter.on("message", listener1);
    emitter.on("data", listener2);
    emitter.removeAllListeners();

    await emitter.emit("message", "hello");
    await emitter.emit("data", { value: 42 });

    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).not.toHaveBeenCalled();
  });

  it("should handle async listeners", async () => {
    const emitter = new Emitter<TestEvents>();
    const order: number[] = [];

    emitter.on("message", async () => {
      await new Promise((r) => setTimeout(r, 10));
      order.push(1);
    });
    emitter.on("message", () => {
      order.push(2);
    });

    await emitter.emit("message", "hello");

    expect(order).toContain(1);
    expect(order).toContain(2);
  });

  it("should not throw when emitting event with no listeners", async () => {
    const emitter = new Emitter<TestEvents>();
    await expect(emitter.emit("message", "hello")).resolves.toBeUndefined();
  });

  it("should handle void payload events", async () => {
    const emitter = new Emitter<TestEvents>();
    const listener = vi.fn();

    emitter.on("empty", listener);
    await emitter.emit("empty", undefined as unknown as void);

    expect(listener).toHaveBeenCalled();
  });

  it("should handle off() for non-registered listener gracefully", () => {
    const emitter = new Emitter<TestEvents>();
    const listener = vi.fn();

    // Should not throw
    emitter.off("message", listener);
  });

  it("should await promise-returning listeners before resolving emit", async () => {
    const emitter = new Emitter<TestEvents>();
    let resolved = false;

    emitter.on("message", () => {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          resolved = true;
          resolve();
        }, 10);
      });
    });

    await emitter.emit("message", "test");

    expect(resolved).toBe(true);
  });

  it("should handle mix of sync and async listeners in emit", async () => {
    const emitter = new Emitter<TestEvents>();
    const results: string[] = [];

    // Sync listener
    emitter.on("message", () => {
      results.push("sync");
    });
    // Async listener returning a Promise
    emitter.on("message", () => {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          results.push("async");
          resolve();
        }, 5);
      });
    });

    await emitter.emit("message", "hello");

    expect(results).toContain("sync");
    expect(results).toContain("async");
  });

  it("should not call off on event that was never registered", () => {
    const emitter = new Emitter<TestEvents>();
    // off on an event with no listener set at all
    expect(() => emitter.off("data", vi.fn())).not.toThrow();
  });

  describe("once", () => {
    it("should call listener only once", async () => {
      const emitter = new Emitter<TestEvents>();
      const listener = vi.fn();

      emitter.once("message", listener);
      await emitter.emit("message", "first");
      await emitter.emit("message", "second");

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith("first");
    });

    it("should not interfere with on() listeners", async () => {
      const emitter = new Emitter<TestEvents>();
      const onceListener = vi.fn();
      const onListener = vi.fn();

      emitter.once("message", onceListener);
      emitter.on("message", onListener);

      await emitter.emit("message", "hello");
      await emitter.emit("message", "world");

      expect(onceListener).toHaveBeenCalledTimes(1);
      expect(onListener).toHaveBeenCalledTimes(2);
    });

    it("should support async once listeners", async () => {
      const emitter = new Emitter<TestEvents>();
      let resolved = false;

      emitter.once("message", async () => {
        await new Promise<void>((r) => setTimeout(r, 5));
        resolved = true;
      });

      await emitter.emit("message", "test");
      expect(resolved).toBe(true);
    });
  });

  describe("emit error handling", () => {
    it("should catch sync listener errors and continue", async () => {
      const emitter = new Emitter<TestEvents>();
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // noop
      });
      const listener2 = vi.fn();

      emitter.on("message", () => {
        throw new Error("sync fail");
      });
      emitter.on("message", listener2);

      await emitter.emit("message", "hello");

      expect(consoleSpy).toHaveBeenCalledWith("Emitter listener error:", expect.any(Error));
      expect(listener2).toHaveBeenCalledWith("hello");
      consoleSpy.mockRestore();
    });

    it("should catch async listener errors and continue", async () => {
      const emitter = new Emitter<TestEvents>();
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // noop
      });

      emitter.on("message", () => {
        throw new Error("async fail");
      });

      // Should not throw
      await expect(emitter.emit("message", "hello")).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith("Emitter listener error:", expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});
