import { describe, it, expect } from "vitest";

import { CommandQueue } from "./command-queue";

describe("CommandQueue", () => {
  it("should execute a single enqueued operation", async () => {
    const queue = new CommandQueue();
    const result = await queue.enqueue(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it("should serialize concurrent operations", async () => {
    const queue = new CommandQueue();
    const order: number[] = [];

    const p1 = queue.enqueue(async () => {
      await new Promise((r) => setTimeout(r, 30));
      order.push(1);
      return "first";
    });

    const p2 = queue.enqueue(() => {
      order.push(2);
      return Promise.resolve("second");
    });

    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1).toBe("first");
    expect(r2).toBe("second");
    // p2 must not start until p1 finishes
    expect(order).toEqual([1, 2]);
  });

  it("should continue processing after a rejected operation", async () => {
    const queue = new CommandQueue();

    const p1 = queue.enqueue(() => Promise.reject(new Error("fail")));
    const p2 = queue.enqueue(() => Promise.resolve("ok"));

    await expect(p1).rejects.toThrow("fail");
    expect(await p2).toBe("ok");
  });

  it("should propagate the correct return type", async () => {
    const queue = new CommandQueue();
    const result = await queue.enqueue(() => Promise.resolve({ value: "typed" }));
    expect(result).toEqual({ value: "typed" });
  });

  it("should handle many queued operations in order", async () => {
    const queue = new CommandQueue();
    const results: number[] = [];

    const promises = Array.from({ length: 10 }, (_, i) =>
      queue.enqueue(() => {
        results.push(i);
        return Promise.resolve(i);
      }),
    );

    const values = await Promise.all(promises);
    expect(values).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});
