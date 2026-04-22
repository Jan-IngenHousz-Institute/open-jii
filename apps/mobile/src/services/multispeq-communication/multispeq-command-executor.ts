import type { Emitter } from "~/utils/emitter";

import type { MultispeqStreamEvents } from "./multispeq-stream-events";

export interface IMultispeqCommandExecutor {
  execute(command: string | object): Promise<string | object>;
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

  execute(command: string | object): Promise<object | string> {
    // Preempt any in-flight execute() so a follow-up call (e.g. cancel) does
    // not race against a stale handler. The previous caller's awaited promise
    // rejects; the new call becomes the sole owner of the next reply.
    if (this.currentReject) {
      const reject = this.currentReject;
      this.currentResolve = undefined;
      this.currentReject = undefined;
      reject(new Error("Superseded by new execute call"));
    }

    return new Promise<object | string>((resolve, reject) => {
      this.currentResolve = resolve;
      this.currentReject = reject;
      this.emitter.emit("sendCommandToDevice", command).catch((err: unknown) => {
        if (this.currentReject === reject) {
          this.currentResolve = undefined;
          this.currentReject = undefined;
          reject(err instanceof Error ? err : new Error(String(err)));
        }
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
