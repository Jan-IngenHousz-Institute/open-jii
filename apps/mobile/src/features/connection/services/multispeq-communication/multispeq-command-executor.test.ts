import { describe, it, expect, beforeEach, vi } from "vitest";
import { Emitter } from "~/utils/emitter";

import { MultispeqCommandExecutor } from "./multispeq-command-executor";
import type { MultispeqStreamEvents } from "./multispeq-stream-events";

/**
 * Wrap an Emitter as a fake device: every command sent via "sendCommandToDevice"
 * is captured so the test can drive a corresponding "receivedReplyFromDevice"
 * reply at a chosen moment.
 */
function createFakeDevice() {
  const emitter = new Emitter<MultispeqStreamEvents>();
  const sentCommands: (string | object)[] = [];
  const destroyed = vi.fn();

  emitter.on("sendCommandToDevice", (cmd) => {
    sentCommands.push(cmd);
  });
  emitter.on("destroy", () => {
    destroyed();
  });

  const reply = (data: object | string, checksum = "") =>
    emitter.emit("receivedReplyFromDevice", { data, checksum });

  return { emitter, sentCommands, destroyed, reply };
}

describe("MultispeqCommandExecutor", () => {
  let device: ReturnType<typeof createFakeDevice>;
  let executor: MultispeqCommandExecutor;

  beforeEach(() => {
    device = createFakeDevice();
    executor = new MultispeqCommandExecutor(device.emitter);
  });

  it("sends the command to the device and resolves with the next reply", async () => {
    const pending = executor.execute("hello");

    expect(device.sentCommands).toEqual(["hello"]);

    await device.reply({ ok: true });

    await expect(pending).resolves.toEqual({ ok: true });
  });

  it("forwards object commands unchanged", async () => {
    const protocol = [{ pulses: [1, 2, 3] }];
    const pending = executor.execute(protocol);

    expect(device.sentCommands[0]).toBe(protocol);

    await device.reply("raw-string-reply");
    await expect(pending).resolves.toBe("raw-string-reply");
  });

  describe("preemption (cancel race)", () => {
    it("a follow-up execute() rejects the in-flight call with 'Superseded by new execute call'", async () => {
      const original = executor.execute("long-running");
      const cancel = executor.execute("-1+");

      await expect(original).rejects.toThrow("Superseded by new execute call");

      // The pending cancel must still be live and resolve from the next reply.
      await device.reply({ cancelled: true });
      await expect(cancel).resolves.toEqual({ cancelled: true });
    });

    it("only the latest execute() receives the next reply (no double-resolve)", async () => {
      const original = executor.execute("long-running");
      const cancel = executor.execute("-1+");

      // Swallow the original rejection so it doesn't surface as unhandled.
      const originalSettled = original.catch((err: Error) => err);

      await device.reply({ from: "device" });

      await expect(cancel).resolves.toEqual({ from: "device" });
      const originalErr = await originalSettled;
      expect(originalErr).toBeInstanceOf(Error);
      expect((originalErr as Error).message).toBe("Superseded by new execute call");

      // Both commands were written to the wire.
      expect(device.sentCommands).toEqual(["long-running", "-1+"]);
    });

    it("a reply that arrives with no in-flight execute() does not leak into the next call", async () => {
      // Simulate a stray reply (e.g. the device's response to a previous
      // cancel that arrived after the executor had already settled).
      await device.reply({ stray: true });

      // The next execute() must wait for its own reply, NOT pick up the stray.
      const pending = executor.execute("hello");
      let settled = false;
      void pending.then(
        () => {
          settled = true;
        },
        () => {
          settled = true;
        },
      );

      // Yield the microtask queue — without the regression fix the executor
      // would have already resolved from the emitter's history buffer.
      await Promise.resolve();
      await Promise.resolve();
      expect(settled).toBe(false);

      await device.reply({ fresh: true });
      await expect(pending).resolves.toEqual({ fresh: true });
    });
  });

  describe("destroy", () => {
    it("rejects an in-flight execute() with 'Executor destroyed'", async () => {
      const pending = executor.execute("hello");

      await executor.destroy();

      await expect(pending).rejects.toThrow("Executor destroyed");
      expect(device.destroyed).toHaveBeenCalledTimes(1);
    });

    it("unregisters the reply listener so post-destroy replies do nothing", async () => {
      await executor.destroy();

      // After destroy() the executor should no longer be subscribed; emitting
      // a reply must not throw, and a fresh executor should not pick it up
      // from history.
      await device.reply({ late: true });

      // Re-attach a fresh executor on the same emitter and verify the stale
      // reply does not surface.
      const next = new MultispeqCommandExecutor(device.emitter);
      const pending = next.execute("hello");

      let settled = false;
      void pending.then(
        () => {
          settled = true;
        },
        () => {
          settled = true;
        },
      );
      await Promise.resolve();
      await Promise.resolve();
      expect(settled).toBe(false);

      await device.reply({ ok: true });
      await expect(pending).resolves.toEqual({ ok: true });
    });
  });

  describe("write failures", () => {
    it("rejects the execute() promise when the device write fails", async () => {
      const failing = new Emitter<MultispeqStreamEvents>();
      failing.on("sendCommandToDevice", () => {
        throw new Error("BT write failed");
      });
      // Suppress the emitter's default console.log error sink for this test.
      failing.onError(vi.fn());

      const exec = new MultispeqCommandExecutor(failing);
      await expect(exec.execute("hello")).rejects.toThrow("BT write failed");
    });
  });
});
