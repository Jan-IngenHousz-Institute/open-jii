import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  flushProtocolSave,
  registerProtocolFlush,
  __resetProtocolSaveRegistry,
} from "./protocol-save-registry";

describe("protocol-save-registry", () => {
  beforeEach(() => {
    __resetProtocolSaveRegistry();
  });

  it("flushing an unknown protocol id is a no-op", async () => {
    await expect(flushProtocolSave("missing")).resolves.toBeUndefined();
  });

  it("flush invokes the registered flush function for that protocol", async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    registerProtocolFlush("p1", flush);

    await flushProtocolSave("p1");

    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("awaits the registered flush before resolving", async () => {
    const order: string[] = [];
    registerProtocolFlush("p1", async () => {
      await Promise.resolve();
      order.push("flush-done");
    });

    await flushProtocolSave("p1");
    order.push("after-flush");

    expect(order).toEqual(["flush-done", "after-flush"]);
  });

  it("only flushes the requested protocol", async () => {
    const flushA = vi.fn().mockResolvedValue(undefined);
    const flushB = vi.fn().mockResolvedValue(undefined);
    registerProtocolFlush("a", flushA);
    registerProtocolFlush("b", flushB);

    await flushProtocolSave("a");

    expect(flushA).toHaveBeenCalledTimes(1);
    expect(flushB).not.toHaveBeenCalled();
  });

  it("the returned cleanup unregisters the flush function", async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const unregister = registerProtocolFlush("p1", flush);

    unregister();
    await flushProtocolSave("p1");

    expect(flush).not.toHaveBeenCalled();
  });

  it("cleanup does not remove a newer registration for the same id", async () => {
    const first = vi.fn().mockResolvedValue(undefined);
    const second = vi.fn().mockResolvedValue(undefined);
    const unregisterFirst = registerProtocolFlush("p1", first);
    registerProtocolFlush("p1", second);

    // The first cell unmounting must not clobber the second cell's flush.
    unregisterFirst();
    await flushProtocolSave("p1");

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
