import type { Emitter } from "~/features/connection/utils/emitter";

import { MULTISPEQ_CONSOLE, MULTISPEQ_FRAMING, resolveCommandTimeoutMs } from "@repo/iot";

import type { MultispeqStreamEvents } from "./multispeq-stream-events";

export interface ExecuteOptions {
  /** Override the response timeout (ms) for this command. */
  timeoutMs?: number;
}

export interface IMultispeqCommandExecutor {
  execute(command: string | object, options?: ExecuteOptions): Promise<string | object>;
  destroy(): Promise<void>;
}

export class MultispeqCommandExecutor implements IMultispeqCommandExecutor {
  private currentResolve?: (data: object | string) => void;
  private currentReject?: (reason: unknown) => void;
  private readonly handler = (payload: { data: object | string; checksum: string }) => {
    const resolve = this.currentResolve;
    this.currentResolve = undefined;
    this.currentReject = undefined;
    resolve?.(payload.data);
  };

  constructor(private readonly emitter: Emitter<MultispeqStreamEvents>) {
    // Single permanent listener: prevents the emitter's history buffer from
    // trapping replies that arrive between command/response pairs and avoids
    // multiple in-flight execute() calls each registering their own handler
    // (which would resolve from the same payload).
    this.emitter.on("receivedReplyFromDevice", this.handler);
  }

  execute(command: string | object, options?: ExecuteOptions): Promise<object | string> {
    // Preempt any in-flight execute() so a follow-up call (e.g. cancel) does
    // not race against a stale handler. The previous caller's awaited promise
    // rejects; the new call becomes the sole owner of the next reply.
    if (this.currentReject) {
      const reject = this.currentReject;
      this.currentResolve = undefined;
      this.currentReject = undefined;
      reject(new Error("Superseded by new execute call"));
    }

    const timeoutMs =
      options?.timeoutMs ?? resolveCommandTimeoutMs(command, MULTISPEQ_FRAMING.DEFAULT_TIMEOUT);

    return new Promise<object | string>((resolve, reject) => {
      let settled = false;

      // Single-shot settle: the timeout, the device reply, a send failure, a
      // supersede, and destroy() can never resolve/reject twice or leak the
      // timer. `timer` is captured lazily so the helpers can reference it.
      const settleOnce = (run: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        run();
      };
      const resolveOnce = (data: object | string) => settleOnce(() => resolve(data));
      const rejectOnce = (reason: unknown) =>
        settleOnce(() => reject(reason instanceof Error ? reason : new Error(String(reason))));

      const timer = setTimeout(() => {
        if (this.currentReject === rejectOnce) {
          this.currentResolve = undefined;
          this.currentReject = undefined;
        }
        // The device may still be running a long protocol. Abort it so it turns
        // the actinic light off and returns to idle instead of running to
        // completion and dropping the connection (OJD-1565).
        this.emitter.emit("sendCommandToDevice", MULTISPEQ_CONSOLE.CANCEL).catch(() => undefined);
        rejectOnce(new Error("Command timeout"));
      }, timeoutMs);

      this.currentResolve = resolveOnce;
      this.currentReject = rejectOnce;

      this.emitter.emit("sendCommandToDevice", command).catch((err: unknown) => {
        if (this.currentReject === rejectOnce) {
          this.currentResolve = undefined;
          this.currentReject = undefined;
        }
        rejectOnce(err);
      });
    });
  }

  destroy() {
    this.emitter.off("receivedReplyFromDevice", this.handler);
    if (this.currentReject) {
      const reject = this.currentReject;
      this.currentResolve = undefined;
      this.currentReject = undefined;
      reject(new Error("Executor destroyed"));
    }
    return this.emitter.emit("destroy");
  }
}
